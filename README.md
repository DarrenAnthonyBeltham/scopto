# ⚡ SCOPTO.IO - Pro Crypto Portfolio Tracker

**Scopto** is a futuristic, cyberpunk-themed Web3 portfolio tracker built with **Next.js**, **Supabase**, and **Ethers.js**. It allows users to track Ethereum wallets, monitor live market data via on-chain oracles, and visualize asset allocation in a high-contrast, professional dashboard.

---

## 🚀 Key Features

### 💎 Portfolio Management
* **Multi-Wallet Tracking:** Add and monitor multiple Ethereum addresses simultaneously.
* **Live Net Worth:** Automatic calculation of total holdings across all tracked wallets.
* **Token Discovery:** Automatically fetches native ETH and ERC-20 token balances using the Ethplorer API.
* **Dust Filter:** One-click toggle to hide assets worth less than $1.

### 📊 Real-Time Market Data
* **Censorship-Resistant Pricing:** Uses **Chainlink On-Chain Oracles** to fetch ETH prices directly from the blockchain, bypassing API blocks and CORS issues.
* **Global Metrics:** Real-time updates for Global Crypto Volume (24H) via CoinLore.
* **Animated Counters:** Smooth counting animations for all numerical data updates.

### 🐳 Whale Watchlist
* **Pre-loaded Whales:** Instantly track famous wallets (Vitalik Buterin, Binance Cold Storage, Justin Sun, etc.) with a single click.
* **Deep Insights:** See exactly what the biggest players in crypto are holding.

### 🎨 Cyberpunk UI/UX
* **Glassmorphism Design:** Frosted glass panels, neon borders, and glowing text effects.
* **Custom Modals:** Replaced all native browser popups with styled, dark-mode modals.
* **Responsive:** Fully fluid layout that works on desktop and mobile.
* **CSV Export:** Download full portfolio data for spreadsheet analysis.

---

## 🛠️ Tech Stack

* **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [React Bootstrap](https://react-bootstrap.github.io/) + Custom CSS-in-JS
* **Backend/Auth:** [Supabase](https://supabase.com/) (Magic Link Auth & PostgreSQL)
* **Blockchain Interaction:** [Ethers.js v6](https://docs.ethers.org/)
* **Data Sources:**
    * **Chainlink Oracle:** Decentralized ETH Price feeds.
    * **CoinLore:** Global Volume data.
    * **Ethplorer:** Token balances and metadata.
    * **LlamaRPC:** Public RPC endpoint for blockchain connection.

---

## 🖼️ Application Overview

### Login Screen
A secure, email-based Magic Link login system styled with a dark, minimalist aesthetic.

### The Dashboard
* **Top Bar:** Live ETH Price ticker (On-Chain) and Disconnect button.
* **Stats Deck:** Total Net Worth and Global 24H Volume with neon glow effects.
* **Wallet Cards:** Individual cards for every tracked wallet showing granular token details, balances, and values.
