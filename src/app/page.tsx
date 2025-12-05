'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ethers } from 'ethers'
import { Container, Navbar, Button, Card, Form, Row, Col, Table, Spinner, Badge, Modal } from 'react-bootstrap'
import { Session } from '@supabase/supabase-js'
import { Rajdhani } from 'next/font/google'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'

const techFont = Rajdhani({ 
  subsets: ['latin'], 
  weight: ['400', '600', '700'] 
})

const COLORS = ['#00f3ff', '#bc13fe', '#fe135d', '#f3fe13', '#13fe8d']

const NETWORKS = {
  ethereum: "https://eth.llamarpc.com",
}

const FAMOUS_WHALES = [
  { name: "Binance Cold Wallet", address: "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503" },
  { name: "Vitalik Buterin", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { name: "Ethereum Foundation", address: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe" },
  { name: "Justin Sun (Tron)", address: "0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296" }
]

interface Token {
  symbol: string
  name: string
  balance: number
  price: number
  valueUSD: number
  isNative: boolean
}

interface WalletData {
  id: number
  user_id: string
  wallet_address: string
  nickname?: string
  ens_name?: string | null
  created_at: string
  tokens: Token[]
}

function AnimatedCounter({ value, prefix = "$" }: { value: number, prefix?: string }) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValue = useRef(value)
  const startTime = useRef<number | null>(null)
  const duration = 1500 

  useEffect(() => {
    previousValue.current = displayValue
    startTime.current = null
    let animationFrameId: number

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = timestamp - startTime.current
      const percentage = Math.min(progress / duration, 1)
      const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4)
      
      const current = previousValue.current + (value - previousValue.current) * easeOutQuart(percentage)
      setDisplayValue(current)

      if (progress < duration) {
        animationFrameId = requestAnimationFrame(animate)
      }
    }

    animationFrameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrameId)
  }, [value])

  return (
    <span>
      {prefix}{displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  )
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [addressInput, setAddressInput] = useState<string>('')
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [email, setEmail] = useState<string>('')
  const [loginMessage, setLoginMessage] = useState<string>('')
  
  const [liveEthPrice, setLiveEthPrice] = useState<number>(0)
  const [liveGlobalVolume, setLiveGlobalVolume] = useState<number>(0)
  
  const [hideDust, setHideDust] = useState<boolean>(true)
  const [showWhaleModal, setShowWhaleModal] = useState<boolean>(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [walletToDelete, setWalletToDelete] = useState<number | null>(null)

  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [walletToRename, setWalletToRename] = useState<number | null>(null)
  const [tempNickname, setTempNickname] = useState('')

  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) initDashboard(session.user.id)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) initDashboard(session.user.id)
      setAuthLoading(false)
    })

    fetchMarketData() 
    const intervalId = setInterval(() => {
        fetchMarketData()
    }, 15000)

    return () => {
        subscription.unsubscribe()
        clearInterval(intervalId)
    }
  }, [])

  const initDashboard = (userId: string) => {
    fetchSavedWallets(userId)
    fetchMarketData()
  }

  const fetchMarketData = async () => {
    try {
        const ethRes = await fetch('https://api.coincap.io/v2/assets/ethereum')
        const ethJson = await ethRes.json()
        if (ethJson.data && ethJson.data.priceUsd) {
            setLiveEthPrice(parseFloat(ethJson.data.priceUsd))
        }

        const assetsRes = await fetch('https://api.coincap.io/v2/assets?limit=100')
        const assetsJson = await assetsRes.json()
        if (assetsJson.data) {
            const totalVol = assetsJson.data.reduce((acc: number, asset: any) => {
                return acc + (parseFloat(asset.volumeUsd24Hr) || 0)
            }, 0)
            setLiveGlobalVolume(totalVol)
        }
    } catch (e) {
        console.warn('Market Data Error:', e)
    }
  }

  const fetchSavedWallets = async (userId: string) => {
    const { data, error } = await supabase
      .from('saved_wallets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }) 

    if (!error && data) {
      fetchBlockchainData(data)
    }
  }

  const fetchBlockchainData = async (rawWallets: any[]) => {
    setLoading(true)
    const provider = new ethers.JsonRpcProvider(NETWORKS.ethereum)

    const enriched = await Promise.all(rawWallets.map(async (w) => {
      let tokens: Token[] = []
      let ensName = null

      try {
        try {
          ensName = await provider.lookupAddress(w.wallet_address)
        } catch {}

        const res = await fetch(`https://api.ethplorer.io/getAddressInfo/${w.wallet_address}?apiKey=freekey`)
        const data = await res.json()

        if (data.ETH) {
          const bal = data.ETH.balance
          if (bal > 0) {
            tokens.push({ symbol: 'ETH', name: 'Ethereum', balance: bal, price: 0, valueUSD: 0, isNative: true })
          }
        }

        if (data.tokens) {
          data.tokens.forEach((t: any) => {
            const dec = t.tokenInfo.decimals || 18
            const bal = t.balance / Math.pow(10, dec)
            const price = t.tokenInfo.price?.rate || 0
            const val = bal * price
            if (val > 0) {
              tokens.push({
                symbol: t.tokenInfo.symbol,
                name: t.tokenInfo.name,
                balance: bal,
                price,
                valueUSD: val,
                isNative: false
              })
            }
          })
        }
      } catch (err) {
        try {
            const rawBalance = await provider.getBalance(w.wallet_address)
            const ethBal = parseFloat(ethers.formatEther(rawBalance))
            if(ethBal > 0) {
                tokens.push({ symbol: 'ETH', name: 'Ethereum', balance: ethBal, price: 0, valueUSD: 0, isNative: true })
            }
        } catch {}
      }

      return { ...w, ens_name: ensName, tokens }
    }))

    setWallets(enriched)
    setLoading(false)
  }

  const { totalNetWorth, displayWallets, chartData } = useMemo(() => {
    let grandTotal = 0
    const assetDistribution: Record<string, number> = {}

    const processedWallets = wallets.map(wallet => {
        let walletTotal = 0
        const processedTokens = wallet.tokens.map(token => {
            let finalPrice = token.price
            let finalValue = token.valueUSD
            if (token.isNative || token.symbol === 'ETH') {
                finalPrice = liveEthPrice
                finalValue = token.balance * liveEthPrice
            }
            walletTotal += finalValue
            
            if(assetDistribution[token.symbol]) {
                assetDistribution[token.symbol] += finalValue
            } else {
                assetDistribution[token.symbol] = finalValue
            }

            return { ...token, price: finalPrice, valueUSD: finalValue }
        })
        grandTotal += walletTotal
        return { ...wallet, tokens: processedTokens, totalValueUSD: walletTotal }
    })

    const chartArray = Object.keys(assetDistribution)
        .map(key => ({ name: key, value: assetDistribution[key] }))
        .sort((a, b) => b.value - a.value)
        .filter(item => item.value > 10) 
        .slice(0, 5) 

    return { totalNetWorth: grandTotal, displayWallets: processedWallets, chartData: chartArray }
  }, [wallets, liveEthPrice])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Explicitly grab the current URL (localhost or vercel app)
    const currentURL = window.location.origin
    
    const { error } = await supabase.auth.signInWithOtp({ 
        email,
        options: {
            emailRedirectTo: currentURL
        }
    })
    setLoginMessage(error ? error.message : 'Check your email for the magic link!')
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setWallets([])
    setEmail('')
  }

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    addWalletToDb(addressInput)
  }

  const addWalletToDb = async (address: string, nickname?: string) => {
    if (!ethers.isAddress(address)) {
        setAlertMessage('Invalid Ethereum Address')
        setShowAlertModal(true)
        return
    }
    
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return

    setLoading(true)
    setShowWhaleModal(false)

    const { error } = await supabase.from('saved_wallets').insert([{ 
      user_id: user.id, 
      wallet_address: address,
      nickname: nickname || '' 
    }])
    
    if (error) {
        setAlertMessage('Error adding wallet: ' + error.message)
        setShowAlertModal(true)
        setLoading(false)
    } else {
        setAddressInput('')
        fetchSavedWallets(user.id)
    }
  }

  const requestDelete = (id: number) => {
      setWalletToDelete(id)
      setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (walletToDelete) {
        await supabase.from('saved_wallets').delete().eq('id', walletToDelete)
        setWallets(prev => prev.filter(w => w.id !== walletToDelete))
        setShowDeleteModal(false)
        setWalletToDelete(null)
    }
  }

  const requestRename = (id: number, currentName?: string) => {
      setWalletToRename(id)
      setTempNickname(currentName || '')
      setShowNicknameModal(true)
  }

  const saveNickname = async () => {
      if (walletToRename) {
        await supabase.from('saved_wallets').update({ nickname: tempNickname }).eq('id', walletToRename)
        setWallets(prev => prev.map(w => w.id === walletToRename ? { ...w, nickname: tempNickname } : w))
        setShowNicknameModal(false)
        setWalletToRename(null)
      }
  }

  const downloadCSV = () => {
    const headers = ['Wallet', 'Symbol', 'Balance', 'Value USD']
    const rows: string[] = []
    displayWallets.forEach(w => {
      w.tokens.forEach(t => {
        rows.push(`${w.nickname || w.wallet_address},${t.symbol},${t.balance},${t.valueUSD.toFixed(2)}`)
      })
    })
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "scopto_portfolio.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (authLoading) {
    return (
        <Container fluid className={`d-flex flex-column align-items-center justify-content-center vh-100 ${techFont.className}`} style={{background: '#050505'}}>
            <Spinner animation="border" variant="info" />
        </Container>
    )
  }

  if (!session) {
    return (
      <Container fluid className={`d-flex flex-column align-items-center justify-content-center vh-100 ${techFont.className}`} style={{background: '#050505'}}>
        <h1 className="fw-bold mb-4 display-3 text-white" style={{letterSpacing: '4px'}}>SCOPTO<span style={{color: '#00f3ff'}}>.IO</span></h1>
        <Card className="shadow-lg border-0 p-5" style={{ width: '100%', maxWidth: '400px', background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-4">
              <Form.Label className="text-white-50 small letter-spacing-2">ACCESS PROTOCOL</Form.Label>
              <Form.Control type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={{background: '#000', border: '1px solid #333', color: 'white'}} />
            </Form.Group>
            <Button variant="outline-info" type="submit" className="w-100 py-3 fw-bold rounded-0" disabled={loading} style={{boxShadow: '0 0 15px rgba(0,243,255,0.2)', letterSpacing: '2px'}}>
              {loading ? 'INITIALIZING...' : 'CONNECT'}
            </Button>
          </Form>
          {loginMessage && <Badge bg="info" className="mt-4 p-2 w-100">{loginMessage}</Badge>}
        </Card>
      </Container>
    )
  }

  return (
    <div className={`min-vh-100 pb-5 ${techFont.className}`} style={{background: '#050505', color: '#e0e0e0'}}>
      <style jsx global>{`
        body { margin: 0; padding: 0; background: #050505; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #00f3ff; }

        .glass-nav {
            background: rgba(10, 10, 10, 0.85);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid rgba(0, 243, 255, 0.2);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
        }
        
        .cyber-card {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            position: relative;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        }

        .cyber-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 2px;
            background: linear-gradient(90deg, transparent, #00f3ff, transparent);
            opacity: 0.3;
        }

        .text-neon { color: #00f3ff; text-shadow: 0 0 15px rgba(0,243,255,0.5); }
        .text-white-bright { color: #fff !important; text-shadow: 0 0 10px rgba(255,255,255,0.1); }
        .text-white-50-custom { color: rgba(255,255,255,0.6) !important; }

        .form-control-cyber {
            background: #000 !important;
            border: 1px solid #222 !important;
            color: #fff !important;
            border-radius: 0;
            padding: 12px;
            font-family: monospace;
        }
        .form-control-cyber:focus {
            border-color: #00f3ff !important;
            box-shadow: 0 0 20px rgba(0,243,255,0.15) !important;
        }

        .table-cyber { --bs-table-bg: transparent; --bs-table-color: #fff; border-color: #1a1a1a; }
        .table-cyber th { color: #888; font-weight: 600; letter-spacing: 1px; font-size: 0.8rem; text-transform: uppercase; border-bottom: 1px solid #222; }
        .table-cyber td { vertical-align: middle; border-bottom: 1px solid #1a1a1a; font-size: 1.1rem; }
        
        .modal-content {
            background: #080810;
            border: 1px solid #333;
            color: white;
            box-shadow: 0 0 60px rgba(0,0,0,0.9);
        }
        .modal-header { border-bottom: 1px solid #222; }
        .modal-footer { border-top: 1px solid #222; }

        .btn-neon {
            background: rgba(0, 243, 255, 0.1);
            border: 1px solid #00f3ff;
            color: #00f3ff;
            transition: 0.3s;
            letter-spacing: 1px;
            border-radius: 0;
        }
        .btn-neon:hover {
            background: #00f3ff;
            color: black;
            box-shadow: 0 0 30px rgba(0,243,255,0.6);
        }

        .btn-neon-outline {
            background: transparent;
            border: 1px solid #00f3ff;
            color: #00f3ff;
            border-radius: 0;
            transition: 0.3s;
        }
        .btn-neon-outline:hover {
            background: rgba(0, 243, 255, 0.1);
            color: #fff;
            box-shadow: 0 0 15px rgba(0,243,255,0.3);
        }

        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 243, 255, 0.7); }
            70% { box-shadow: 0 0 0 6px rgba(0, 243, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 243, 255, 0); }
        }
        .live-dot { width: 8px; height: 8px; background: #00f3ff; border-radius: 50%; animation: pulse 2s infinite; }
      `}</style>

      <Navbar fixed="top" className="glass-nav py-3" variant="dark">
        <Container fluid className="px-4">
          <Navbar.Brand className="fw-bold fs-3 text-white" style={{letterSpacing: '3px'}}>
            SCOPTO<span className="text-neon">.IO</span>
          </Navbar.Brand>
          <div className="d-flex align-items-center gap-4">
            <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-0" style={{background: 'rgba(0,0,0,0.5)', border: '1px solid #222'}}>
                <div className={`live-dot ${liveEthPrice === 0 ? 'bg-danger' : ''}`}></div>
                <span className="text-white small fw-bold font-monospace">
                   ETH: {liveEthPrice > 0 ? `$${liveEthPrice.toLocaleString()}` : 'CONNECTING...'}
                </span>
            </div>
            <Button size="sm" onClick={handleLogout} className="btn-neon-outline px-4 py-2" style={{letterSpacing: '1px', fontSize: '0.8rem'}}>DISCONNECT</Button>
          </div>
        </Container>
      </Navbar>

      <Container style={{marginTop: '120px'}}>
        <Row className="mb-5 g-4">
          <Col md={4}>
            <Card className="cyber-card h-100 text-center py-5">
              <Card.Body className="d-flex flex-column justify-content-center">
                <h6 className="text-white-50-custom mb-3" style={{letterSpacing: '3px', fontSize: '0.8rem'}}>TOTAL NET WORTH</h6>
                <h1 className="display-4 fw-bold mb-0 text-white-bright">
                    <AnimatedCounter value={totalNetWorth} />
                </h1>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="cyber-card h-100 text-center py-5">
              <Card.Body className="d-flex flex-column justify-content-center">
                <h6 className="text-white-50-custom mb-3" style={{letterSpacing: '3px', fontSize: '0.8rem'}}>GLOBAL CRYPTO VOLUME (24H)</h6>
                <h1 className="display-4 fw-bold mb-0 text-neon">
                    <AnimatedCounter value={liveGlobalVolume} />
                </h1>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="cyber-card h-100 py-2">
                <Card.Body className="d-flex align-items-center justify-content-center flex-column">
                    <h6 className="text-white-50-custom mb-2" style={{letterSpacing: '3px', fontSize: '0.8rem'}}>PORTFOLIO SPLIT</h6>
                    <div style={{ width: '100%', height: 120 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    innerRadius={30}
                                    outerRadius={50}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{background: '#000', border: '1px solid #333', borderRadius: '0', color: 'white'}}
                                    itemStyle={{color: '#00f3ff'}}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="mb-4 align-items-center g-3">
          <Col md={6}>
            <Form onSubmit={handleAddWallet} className="d-flex gap-0">
              <Form.Control 
                placeholder="Enter Ethereum Address (0x...)" 
                value={addressInput} 
                onChange={e => setAddressInput(e.target.value)} 
                className="form-control-cyber"
              />
              <Button type="submit" className="btn-neon px-4 fw-bold">TRACK ID</Button>
            </Form>
          </Col>
          <Col md={6} className="d-flex justify-content-end gap-3 align-items-center">
            <Button variant="link" className="text-decoration-none text-white" onClick={() => setShowWhaleModal(true)}><span className="me-1 text-neon">★</span> WHALE WATCHLIST</Button>
            <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="dustSwitch" checked={hideDust} onChange={() => setHideDust(!hideDust)} style={{backgroundColor: hideDust ? '#00f3ff' : '#333', borderColor: '#333'}} />
                <label className="form-check-label text-white small" htmlFor="dustSwitch">HIDE DUST</label>
            </div>
            <Button variant="outline-success" size="sm" onClick={downloadCSV} className="rounded-0 ms-2" style={{letterSpacing: '1px'}}>EXPORT CSV</Button>
          </Col>
        </Row>

        {loading && <div className="text-center py-5"><Spinner animation="border" variant="info" /></div>}

        <Row>
          {displayWallets.map(wallet => (
            <Col xs={12} key={wallet.id} className="mb-4">
              <Card className="cyber-card">
                <Card.Header className="bg-transparent border-bottom border-secondary py-4 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-4">
                    <div className="rounded-circle d-flex align-items-center justify-content-center" style={{width:'50px', height:'50px', background: 'rgba(0,243,255,0.1)', border:'1px solid rgba(0,243,255,0.3)'}}>
                        <span style={{fontSize:'1.5rem'}}>👤</span>
                    </div>
                    <div>
                        <div className="d-flex align-items-center gap-3">
                            <h4 className="mb-0 fw-bold text-white-bright">{wallet.nickname || wallet.ens_name || 'Unknown Wallet'}</h4>
                            <Button variant="link" className="p-0 text-white-50-custom" onClick={() => requestRename(wallet.id, wallet.nickname)}>✎</Button>
                        </div>
                        <div className="d-flex align-items-center gap-2 mt-1">
                            <small className="font-monospace text-white opacity-75">{wallet.wallet_address}</small>
                            <a href={`https://etherscan.io/address/${wallet.wallet_address}`} target="_blank" className="text-decoration-none text-neon small">↗</a>
                        </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <h3 className="fw-bold mb-0 text-white-bright">
                        ${wallet.totalValueUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </h3>
                    <small className="text-danger" style={{cursor:'pointer', letterSpacing: '1px', fontSize: '0.75rem', fontWeight: 'bold'}} onClick={() => requestDelete(wallet.id)}>TERMINATE TRACKING</small>
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table className="table-cyber mb-0">
                    <thead>
                      <tr>
                        <th className="ps-5">Asset</th>
                        <th className="text-end">Balance</th>
                        <th className="text-end">Price</th>
                        <th className="text-end pe-5">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallet.tokens.filter(t => !hideDust || t.valueUSD > 1).map((token, idx) => (
                          <tr key={idx}>
                            <td className="ps-5">
                                <span className={`fw-bold fs-5 ${token.symbol === 'ETH' ? 'text-neon' : 'text-white'}`}>{token.symbol}</span>
                            </td>
                            <td className="text-end font-monospace text-white opacity-75">{token.balance.toLocaleString()}</td>
                            <td className="text-end font-monospace text-white opacity-75">${token.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="text-end pe-5 font-monospace text-white fw-bold fs-5">${token.valueUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          </tr>
                      ))}
                      {wallet.tokens.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-5 text-white-50-custom fst-italic">NO ASSETS DETECTED</td></tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>

      <Modal show={showWhaleModal} onHide={() => setShowWhaleModal(false)} centered contentClassName="bg-dark text-white border border-secondary">
        <Modal.Header closeButton closeVariant="white" className="border-secondary"><Modal.Title className="fw-bold">STAR WATCHLIST</Modal.Title></Modal.Header>
        <Modal.Body className="bg-black p-0">
          <div className="d-grid">
            {FAMOUS_WHALES.map((whale, idx) => (
              <Button key={idx} variant="outline-dark" onClick={() => addWalletToDb(whale.address, whale.name)} className="text-start d-flex justify-content-between align-items-center p-4 border-bottom border-dark rounded-0 text-white">
                <span className="fw-bold fs-5">{whale.name}</span>
                <span className="text-secondary small font-monospace">{whale.address.substring(0,8)}...</span>
              </Button>
            ))}
          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered contentClassName="bg-dark border-danger">
        <Modal.Header className="bg-danger text-white border-0"><Modal.Title>SYSTEM WARNING</Modal.Title></Modal.Header>
        <Modal.Body className="text-center py-5 bg-black text-white">
          <h2 className="mb-3 text-danger">TERMINATE TRACKING?</h2>
          <p className="text-white">This action will remove the wallet from your local dashboard immediately.</p>
          <div className="d-flex justify-content-center gap-3 mt-5">
             <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)} className="px-4 rounded-0">CANCEL</Button>
             <Button variant="danger" onClick={confirmDelete} className="px-5 rounded-0">CONFIRM</Button>
          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showNicknameModal} onHide={() => setShowNicknameModal(false)} centered contentClassName="bg-dark border-secondary">
        <Modal.Header closeButton closeVariant="white" className="bg-black border-secondary text-white"><Modal.Title>MODIFY LABEL</Modal.Title></Modal.Header>
        <Modal.Body className="bg-black text-white py-4">
            <Form onSubmit={(e) => { e.preventDefault(); saveNickname(); }}>
                <Form.Control type="text" className="form-control-cyber" value={tempNickname} onChange={(e) => setTempNickname(e.target.value)} autoFocus placeholder="Enter new label..." />
            </Form>
        </Modal.Body>
        <Modal.Footer className="bg-black border-secondary">
          <Button variant="outline-secondary" onClick={() => setShowNicknameModal(false)} className="rounded-0">CANCEL</Button>
          <Button variant="info" onClick={saveNickname} className="px-4 rounded-0 btn-neon">SAVE</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAlertModal} onHide={() => setShowAlertModal(false)} centered contentClassName="bg-dark border-info">
        <Modal.Header closeButton closeVariant="white" className="bg-black border-0 text-info"><Modal.Title>SYSTEM NOTICE</Modal.Title></Modal.Header>
        <Modal.Body className="bg-black text-white py-4"><p className="mb-0 fs-5 text-center">{alertMessage}</p></Modal.Body>
        <Modal.Footer className="bg-black border-0 justify-content-center"><Button variant="outline-info" onClick={() => setShowAlertModal(false)} className="px-5 rounded-0 btn-neon">ACKNOWLEDGE</Button></Modal.Footer>
      </Modal>
      
    </div>
  )
}