'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ethers } from 'ethers'
import { Container, Navbar, Button, Card, Form, Row, Col, Table, Spinner, Badge, Modal } from 'react-bootstrap'
import { Session } from '@supabase/supabase-js'
import { Rajdhani } from 'next/font/google'

const techFont = Rajdhani({ 
  subsets: ['latin'], 
  weight: ['400', '600', '700'] 
})

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

const NETWORKS = {
  ethereum: "https://eth.llamarpc.com",
}

const FAMOUS_WHALES = [
  { name: "Binance Cold Wallet", address: "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503" },
  { name: "Vitalik Buterin", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { name: "Ethereum Foundation", address: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe" },
  { name: "Kraken Exchange", address: "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2" },
  { name: "Crypto.com Cold", address: "0x6262998Ced04146fA42253a5C0AF90CA02dfd2A3" },
  { name: "Justin Sun (Tron)", address: "0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296" }
]

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [addressInput, setAddressInput] = useState<string>('')
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [email, setEmail] = useState<string>('')
  const [loginMessage, setLoginMessage] = useState<string>('')
  
  const [liveEthPrice, setLiveEthPrice] = useState<number>(0)
  const [liveEthVolume, setLiveEthVolume] = useState<number>(0)
  
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
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) initDashboard(session.user.id)
    })

    const intervalId = setInterval(() => {
        fetchMarketData()
    }, 10000)

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
        const res = await fetch('https://api.coincap.io/v2/assets/ethereum')
        const json = await res.json()
        const data = json.data

        if (data) {
            setLiveEthPrice(parseFloat(data.priceUsd))
            setLiveEthVolume(parseFloat(data.volumeUsd24Hr))
        }
    } catch (e) {
        console.warn("Market data skipped")
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

  const { totalNetWorth, displayWallets } = useMemo(() => {
    let grandTotal = 0
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
            return { ...token, price: finalPrice, valueUSD: finalValue }
        })
        grandTotal += walletTotal
        return { ...wallet, tokens: processedTokens, totalValueUSD: walletTotal }
    })
    return { totalNetWorth: grandTotal, displayWallets: processedWallets }
  }, [wallets, liveEthPrice])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
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
        setAlertMessage('Invalid Ethereum Address. Please check the format.')
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

  if (!session) {
    return (
      <Container fluid className={`d-flex flex-column align-items-center justify-content-center vh-100 ${techFont.className}`} style={{background: '#050505'}}>
        <style jsx global>{`
          .glass-panel {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
          }
          input { background: rgba(0,0,0,0.5) !important; border: 1px solid #333 !important; color: white !important; }
        `}</style>
        <h1 className="fw-bold mb-4 display-3" style={{color: '#00f3ff', textShadow: '0 0 30px rgba(0,243,255,0.6)'}}>SCOPTO</h1>
        <Card className="shadow border-0 p-5 glass-panel" style={{ width: '100%', maxWidth: '400px', borderRadius: '20px' }}>
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-4">
              <Form.Label className="text-secondary small letter-spacing-2">ACCESS PROTOCOL</Form.Label>
              <Form.Control type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </Form.Group>
            <Button variant="outline-info" type="submit" className="w-100 py-3 fw-bold" disabled={loading} style={{boxShadow: '0 0 15px rgba(0,243,255,0.2)', letterSpacing: '2px'}}>
              {loading ? 'INITIALIZING...' : 'CONNECT'}
            </Button>
          </Form>
          {loginMessage && <Badge bg="info" className="mt-4 p-2 w-100">{loginMessage}</Badge>}
        </Card>
      </Container>
    )
  }

  return (
    <div className={`min-vh-100 pb-5 ${techFont.className}`} style={{background: 'radial-gradient(circle at 50% 0%, #1a1a2e 0%, #000000 100%)', color: '#e0e0e0'}}>
      <style jsx global>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #00f3ff; }

        .glass-nav {
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .cyber-card {
            background: rgba(15, 15, 25, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .cyber-card:hover {
            border-color: rgba(0, 243, 255, 0.4);
            box-shadow: 0 0 30px rgba(0, 243, 255, 0.1);
            transform: translateY(-2px);
        }

        .text-neon { color: #00f3ff; text-shadow: 0 0 15px rgba(0,243,255,0.5); }
        .text-light-muted { color: #b0b0b0 !important; }

        .form-control-cyber {
            background: rgba(255,255,255,0.05) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            color: #fff !important;
            border-radius: 0;
            padding: 12px;
        }
        .form-control-cyber:focus {
            border-color: #00f3ff !important;
            box-shadow: 0 0 20px rgba(0,243,255,0.15) !important;
        }

        .table-cyber { --bs-table-bg: transparent; --bs-table-color: #fff; border-color: rgba(255,255,255,0.05); }
        .table-cyber th { color: #888; font-weight: 600; letter-spacing: 1px; font-size: 0.85rem; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .table-cyber td { vertical-align: middle; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 1.1rem; }
        
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

        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 243, 255, 0.7); }
            70% { box-shadow: 0 0 0 6px rgba(0, 243, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 243, 255, 0); }
        }
        .live-dot { width: 8px; height: 8px; background: #00f3ff; border-radius: 50%; animation: pulse 2s infinite; }
      `}</style>

      <Navbar fixed="top" className="glass-nav py-3">
        <Container fluid className="px-4">
          <Navbar.Brand className="fw-bold fs-3" style={{letterSpacing: '3px'}}>
            SCOPTO<span style={{color: '#00f3ff'}}>.IO</span>
          </Navbar.Brand>
          <div className="d-flex align-items-center gap-4">
            <div className="d-flex align-items-center gap-2 px-3 py-1 rounded" style={{background: 'rgba(255,255,255,0.05)'}}>
                <div className="live-dot"></div>
                <span className="text-white small fw-bold">ETH: ${liveEthPrice.toLocaleString()}</span>
            </div>
            <Button variant="outline-danger" size="sm" onClick={handleLogout} style={{borderRadius: '0', fontSize: '0.75rem', padding: '6px 18px', letterSpacing: '1px'}}>DISCONNECT</Button>
          </div>
        </Container>
      </Navbar>

      <Container style={{marginTop: '120px'}}>
        <Row className="mb-5 g-4">
          <Col md={6}>
            <Card className="cyber-card h-100 text-center py-5">
              <Card.Body className="d-flex flex-column justify-content-center">
                <h6 className="text-secondary mb-3" style={{letterSpacing: '3px', fontSize: '0.8rem'}}>TOTAL NET WORTH</h6>
                <h1 className="display-3 fw-bold mb-0 text-white">
                    <AnimatedCounter value={totalNetWorth} />
                </h1>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="cyber-card h-100 text-center py-5">
              <Card.Body className="d-flex flex-column justify-content-center">
                <h6 className="text-secondary mb-3" style={{letterSpacing: '3px', fontSize: '0.8rem'}}>GLOBAL 24H VOLUME</h6>
                <h1 className="display-3 fw-bold mb-0 text-neon">
                    <AnimatedCounter value={liveEthVolume} />
                </h1>
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
                style={{fontFamily: 'monospace'}}
              />
              <Button type="submit" className="btn-neon px-4 fw-bold">TRACK</Button>
            </Form>
          </Col>
          <Col md={6} className="d-flex justify-content-end gap-3">
            <Button variant="outline-light" className="border-0 text-light-muted" onClick={() => setShowWhaleModal(true)}><span className="me-2 text-neon">★</span>Whales</Button>
            <Button variant="outline-light" className="border-0 text-light-muted" onClick={() => setHideDust(!hideDust)}>{hideDust ? '👁️ Show Dust' : '🚫 Hide Dust'}</Button>
            <Button variant="outline-success" size="sm" onClick={downloadCSV} style={{borderRadius: 0, letterSpacing: '1px'}}>DOWNLOAD CSV</Button>
          </Col>
        </Row>

        {loading && <div className="text-center py-5"><Spinner animation="border" variant="info" /></div>}

        <Row>
          {displayWallets.map(wallet => (
            <Col xs={12} key={wallet.id} className="mb-4">
              <Card className="cyber-card">
                <Card.Header className="bg-transparent border-bottom border-dark py-4 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded-circle d-flex align-items-center justify-content-center" style={{width:'48px', height:'48px', background: 'rgba(0,243,255,0.1)', border:'1px solid rgba(0,243,255,0.2)'}}>
                        <span style={{fontSize:'1.4rem'}}>👤</span>
                    </div>
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h4 className="mb-0 fw-bold text-white">{wallet.nickname || wallet.ens_name || 'Unknown Wallet'}</h4>
                            <Button variant="link" className="p-0 text-secondary" onClick={() => requestRename(wallet.id, wallet.nickname)}>✎</Button>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <small className="text-muted font-monospace">{wallet.wallet_address}</small>
                            <a href={`https://etherscan.io/address/${wallet.wallet_address}`} target="_blank" className="text-decoration-none text-neon small">↗</a>
                        </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <h3 className="fw-bold mb-0 text-white">
                        ${wallet.totalValueUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </h3>
                    <small className="text-danger" style={{cursor:'pointer', letterSpacing: '1px', fontSize: '0.7rem', textTransform: 'uppercase'}} onClick={() => requestDelete(wallet.id)}>STOP TRACKING</small>
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
                            <td className="text-end font-monospace text-light-muted">{token.balance.toLocaleString()}</td>
                            <td className="text-end font-monospace text-light-muted">${token.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="text-end pe-5 font-monospace text-white fw-bold fs-5">${token.valueUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          </tr>
                      ))}
                      {wallet.tokens.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-5 text-muted fst-italic">NO ASSETS DETECTED</td></tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>

      <Modal show={showWhaleModal} onHide={() => setShowWhaleModal(false)} centered contentClassName="bg-dark text-white border-0">
        <Modal.Header closeButton className="border-secondary"><Modal.Title className="fw-bold">STAR WATCHLIST</Modal.Title></Modal.Header>
        <Modal.Body className="bg-black p-0">
          <div className="d-grid">
            {FAMOUS_WHALES.map((whale, idx) => (
              <Button key={idx} variant="outline-dark" onClick={() => addWalletToDb(whale.address, whale.name)} className="text-start d-flex justify-content-between align-items-center p-4 border-bottom border-dark rounded-0 text-light">
                <span className="fw-bold fs-5">{whale.name}</span>
                <span className="text-muted small font-monospace">{whale.address.substring(0,8)}...</span>
              </Button>
            ))}
          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered contentClassName="bg-dark border-danger">
        <Modal.Header className="bg-danger text-white border-0"><Modal.Title>SYSTEM WARNING</Modal.Title></Modal.Header>
        <Modal.Body className="text-center py-5 bg-black text-white">
          <h2 className="mb-3 text-danger">TERMINATE TRACKING?</h2>
          <p className="text-muted">This action will remove the wallet from your local dashboard immediately.</p>
          <div className="d-flex justify-content-center gap-3 mt-5">
             <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)} className="px-4">CANCEL</Button>
             <Button variant="danger" onClick={confirmDelete} className="px-5">CONFIRM</Button>
          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showNicknameModal} onHide={() => setShowNicknameModal(false)} centered contentClassName="bg-dark border-secondary">
        <Modal.Header closeButton className="bg-black border-secondary text-white"><Modal.Title>MODIFY LABEL</Modal.Title></Modal.Header>
        <Modal.Body className="bg-black text-white py-4">
            <Form onSubmit={(e) => { e.preventDefault(); saveNickname(); }}>
                <Form.Control type="text" className="form-control-cyber" value={tempNickname} onChange={(e) => setTempNickname(e.target.value)} autoFocus placeholder="Enter new label..." />
            </Form>
        </Modal.Body>
        <Modal.Footer className="bg-black border-secondary">
          <Button variant="outline-secondary" onClick={() => setShowNicknameModal(false)}>CANCEL</Button>
          <Button variant="info" onClick={saveNickname} className="px-4">SAVE</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAlertModal} onHide={() => setShowAlertModal(false)} centered contentClassName="bg-dark border-info">
        <Modal.Header closeButton className="bg-black border-0 text-info"><Modal.Title>SYSTEM NOTICE</Modal.Title></Modal.Header>
        <Modal.Body className="bg-black text-white py-4"><p className="mb-0 fs-5 text-center">{alertMessage}</p></Modal.Body>
        <Modal.Footer className="bg-black border-0 justify-content-center"><Button variant="outline-info" onClick={() => setShowAlertModal(false)} className="px-5">ACKNOWLEDGE</Button></Modal.Footer>
      </Modal>
      
    </div>
  )
}