'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ethers } from 'ethers'
import { Container, Navbar, Button, Card, Form, Row, Col, Table, Spinner, Alert } from 'react-bootstrap'
import { Session } from '@supabase/supabase-js'

interface WalletData {
  id: number;
  user_id: string;
  wallet_address: string;
  created_at: string;
  balance?: string; 
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [addressInput, setAddressInput] = useState<string>('')
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [ethPrice, setEthPrice] = useState<number>(0)
  
  const [email, setEmail] = useState<string>('')
  const [loginMessage, setLoginMessage] = useState<string>('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchSavedWallets()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchSavedWallets()
    })

    fetchEthPrice()

    return () => subscription.unsubscribe()
  }, [])

  const fetchEthPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      const data = await response.json()
      setEthPrice(data.ethereum.usd)
    } catch (error) {
      console.error(error)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
    })

    if (error) {
      setLoginMessage('Error: ' + error.message)
    } else {
      setLoginMessage('Check your email for the login link!')
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setWallets([])
    setEmail('')
    setLoginMessage('')
  }

  const fetchSavedWallets = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('saved_wallets')
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      console.error(error)
    } else {
      enrichWalletsWithData(data as WalletData[])
    }
  }

  const enrichWalletsWithData = async (walletData: WalletData[]) => {
    setLoading(true)
    const provider = new ethers.JsonRpcProvider('https://cloudflare-eth.com')

    const enriched = await Promise.all(walletData.map(async (w) => {
      try {
        const balanceWei = await provider.getBalance(w.wallet_address)
        const balanceEth = ethers.formatEther(balanceWei)
        return {
          ...w,
          balance: balanceEth,
        }
      } catch (e) {
        return { ...w, balance: '0' }
      }
    }))

    setWallets(enriched)
    setLoading(false)
  }

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ethers.isAddress(addressInput)) {
      alert('Invalid Ethereum Address')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('saved_wallets')
      .insert([
        { user_id: user.id, wallet_address: addressInput },
      ])

    if (error) {
      alert('Error saving wallet')
    } else {
      setAddressInput('')
      fetchSavedWallets()
    }
  }

  if (!session) {
    return (
      <Container className="d-flex flex-column align-items-center justify-content-center vh-100">
        <h1 className="mb-4">Scopto</h1>
        <p className="mb-4">Your Personal Web3 Wealth Dashboard</p>
        
        <Card style={{ width: '350px' }}>
          <Card.Body>
            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3">
                <Form.Label>Sign in via Magic Link</Form.Label>
                <Form.Control 
                  type="email" 
                  placeholder="Enter your email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Form.Group>
              <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                {loading ? 'Sending...' : 'Send Login Link'}
              </Button>
            </Form>
            {loginMessage && (
              <Alert variant="info" className="mt-3 text-center">
                {loginMessage}
              </Alert>
            )}
          </Card.Body>
        </Card>
      </Container>
    )
  }

  return (
    <>
      <Navbar bg="dark" variant="dark" className="mb-4">
        <Container>
          <Navbar.Brand href="#home">Scopto</Navbar.Brand>
          <Navbar.Text className="me-3">
            ETH Price: ${ethPrice.toLocaleString()}
          </Navbar.Text>
          <Button onClick={handleLogout} variant="outline-light" size="sm">Logout</Button>
        </Container>
      </Navbar>

      <Container>
        <Row className="justify-content-center mb-5">
          <Col md={8}>
            <Card>
              <Card.Body>
                <Card.Title>Track a new Wallet</Card.Title>
                <Form onSubmit={handleAddWallet} className="d-flex gap-2">
                  <Form.Control 
                    type="text" 
                    placeholder="Paste Ethereum Address (0x...)" 
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                  />
                  <Button type="submit" variant="success">Track</Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row>
          <Col>
            <h3>Your Watchlist</h3>
            {loading ? (
              <Spinner animation="border" />
            ) : (
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>ETH Balance</th>
                    <th>USD Value</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((wallet) => (
                    <tr key={wallet.id}>
                      <td style={{fontFamily: 'monospace'}}>{wallet.wallet_address}</td>
                      <td>{wallet.balance ? parseFloat(wallet.balance).toFixed(4) : '0.0000'} ETH</td>
                      <td className="fw-bold text-success">
                        ${wallet.balance ? (parseFloat(wallet.balance) * ethPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}
                      </td>
                    </tr>
                  ))}
                  {wallets.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center">No wallets saved yet.</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            )}
          </Col>
        </Row>
      </Container>
    </>
  )
}