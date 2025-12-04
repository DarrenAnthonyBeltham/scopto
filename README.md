# ⚡ SCOPTO.IO - Pro Crypto Portfolio Tracker

![Scopto Banner](https://via.placeholder.com/1200x400/050505/00f3ff?text=SCOPTO+PRO+DASHBOARD)

**Scopto** is a futuristic, cyberpunk-themed Web3 portfolio tracker built with **Next.js**, **Supabase**, and **Ethers.js**. It allows users to track Ethereum wallets, monitor live market data, and visualize asset allocation in a high-contrast, professional dashboard.

---

## 🚀 Key Features

### 💎 Portfolio Management
* **Multi-Wallet Tracking:** Add and monitor multiple Ethereum addresses simultaneously.
* **Live Net Worth:** Automatic calculation of total holdings across all tracked wallets.
* **Token Discovery:** Automatically fetches native ETH and ERC-20 token balances using the Ethplorer API.
* **Dust Filter:** One-click toggle to hide assets worth less than $10.

### 📊 Real-Time Market Data
* **Live Tickers:** Real-time updates for Ethereum Price and Global Crypto Volume (24H).
* **Visual Charts:** Interactive **Neon Pie Chart** showing portfolio asset distribution.
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
* **Data Visualization:** [Recharts](https://recharts.org/)
* **APIs:**
    * **CoinCap:** Live market data.
    * **Ethplorer:** Token balances.
    * **LlamaNodes:** Public RPC endpoint.

---
 
## 🖼️ Application Overview

### Login Screen
A secure, email-based Magic Link login system styled with a dark, minimalist aesthetic.

### The Dashboard
* **Top Bar:** Live ETH Price ticker and Disconnect button.
* **Stats Deck:** Total Net Worth and Global 24H Volume with neon glow effects.
* **Portfolio Split:** A donut chart visualizing asset diversity.
* **Wallet Cards:** Individual cards for every tracked wallet showing granular token details.
