# Getting Started with Insights - Macro Calendar

## What is Insights?

**Insights is an economic calendar application**, not a trading bot. It helps you:
- Track upcoming macroeconomic data releases (GDP, inflation, employment, etc.)
- Save important indicators to your personal watchlist
- Receive email alerts when data is published
- Access historical economic data via API
- Monitor revisions to previously published data

**Important**: This application does NOT:
- Execute trades automatically
- Connect to trading exchanges or wallets
- Require gas fees, USDC, ETH, or other cryptocurrency allocations
- Generate profit on its own

If you're looking for a DeFi trading bot or automated trading system, this is not the right tool. Insights is a **data and information tool** for traders, economists, and analysts.

## How to Use Insights After Deployment

### 1. Access Your Deployed Application

After deploying to Vercel/Railway, you'll have a production URL. Visit it in your browser:
- **Vercel**: `https://your-project.vercel.app`
- **Custom domain**: If you configured one (e.g., `https://econwatch.live`)

### 2. Sign Up / Sign In

1. Click "Sign In" in the top navigation
2. Enter your email address
3. Check your email for a magic link (no password needed)
4. Click the magic link to authenticate

### 3. Browse Economic Releases

The main calendar page shows upcoming releases:
- **Filter by Country**: US, UK, EU, Japan, China, etc.
- **Filter by Category**: GDP, Inflation, Employment, etc.
- **Search**: Find specific indicators (e.g., "Nonfarm Payrolls")
- **Time Range**: View next 7 or 30 days

Each release shows:
- **Date/Time**: When the data will be published
- **Indicator**: What economic metric (e.g., "CPI Y/Y")
- **Forecast**: What analysts expect
- **Previous**: The last published value
- **Actual**: The real value (after publication)

### 4. Create Your Watchlist

Track indicators that matter to you:

1. Find an indicator on the calendar
2. Click the ⭐ (star) button to add it to your watchlist
3. Visit `/watchlist` to see all your saved indicators
4. Toggle email alerts on/off for each indicator

### 5. Enable Email Alerts

Get notified when data is published:

1. Go to your watchlist page
2. Click the bell icon next to any indicator
3. You'll receive an email when:
   - New data is published for that indicator
   - Previous data is revised

### 6. Use the API (Optional)

For programmatic access:

1. Go to **Settings** → **API Keys**
2. Click "Generate API Key"
3. Copy and save your key securely
4. Use it to access `/api/v1` endpoints

**Example API call**:
```bash
curl -H "X-API-Key: your-api-key" \
  https://your-app.vercel.app/api/v1/calendar
```

See `/docs` on your deployed app for full API documentation.

### 7. Configure Webhooks (Optional)

Send release data to your own systems:

1. Go to **Settings** → **Webhooks**
2. Add your endpoint URL
3. Choose which events to receive (published, revised)
4. Your endpoint will receive HTTP POST requests with release data

## How Traders Use Economic Calendars

While Insights doesn't execute trades, here's how traders use macro calendars to make informed decisions:

### Understanding Economic Releases

Economic data releases can significantly impact markets:

- **High-Impact Releases**: NFP (Nonfarm Payrolls), CPI (Inflation), GDP, Interest Rate Decisions
- **Medium-Impact**: Retail Sales, Manufacturing PMI, Trade Balance
- **Low-Impact**: Regional surveys, minor indicators

### Reading the Data

- **Forecast vs Actual**: When actual differs significantly from forecast, markets react
  - Actual > Forecast (usually bullish for currency)
  - Actual < Forecast (usually bearish for currency)
- **Surprise Thresholds**: What counts as "significant" varies by indicator
  - **For percentage-based indicators** (CPI, GDP growth): 0.3-0.5% deviation
  - **For count-based indicators** (NFP jobs): 50K-100K jobs deviation
  - **For rate decisions**: Any change (25 basis points = 0.25%) is significant
  - Check historical volatility of each indicator to set appropriate thresholds
- **Previous Revisions**: Watch for revisions to understand trend changes

### Example Trading Strategy (Manual)

**Note**: This is educational - Insights does not execute these trades for you.

#### 1. Pre-Release Setup
- Identify high-impact releases on your watchlist
- Check forecast and previous values
- Set price alerts on your trading platform (not in Insights)
- Plan entry/exit points based on scenarios

#### 2. Release Day
- Wait for the data to be published (Insights will alert you)
- Compare actual vs forecast:
  - **Surprise > 0.5%**: Strong signal
  - **Surprise > 1.0%**: Very strong signal
- Check for immediate market reaction (on your trading platform)

#### 3. Execute Trade (On Your Trading Platform)
- Use your broker/exchange to place trades
- Apply risk management rules
- Set stop-loss and take-profit levels

### Capital Allocation Example ($250 Starting Capital)

**Important**: This is educational guidance, not financial advice. Insights does not manage your capital or execute trades.

If you want to trade based on economic releases with $250:

#### Safe Approach (Conservative)
- **Risk per trade**: 1-2% of capital = $2.50-$5.00 per trade
- **Position sizing**: Adjust lot size to match risk
- **Number of indicators**: Track 5-10 high-impact releases
- **Reserve**: Keep 20% in cash for opportunities

#### Moderate Approach
- **Risk per trade**: 2-3% of capital = $5.00-$7.50 per trade
- **Position sizing**: Use proper stop-loss placement
- **Number of indicators**: Track 10-15 releases
- **Reserve**: Keep 10-15% in cash

#### What You Need Outside of Insights

1. **Trading Account**: Open account with a broker/exchange
   - Forex broker (for currency trading)
   - Crypto exchange (for crypto trading)
   - Stock broker (for equity trading)

2. **Capital Allocation** (for crypto example):
   - USDC/USDT for stable value (50-70%)
   - ETH/BTC for major crypto exposure (20-30%)
   - Gas fees reserve: $20-30 for transaction costs
   - Trading capital: $180-200 actual

3. **Risk Management**:
   - Never risk more than 2% per trade
   - Use stop-losses on every trade
   - Don't trade every release - be selective
   - Keep a trading journal

## Next Steps

### 1. Set Up Your Watchlist
Start by adding indicators relevant to your trading strategy:
- **Forex traders**: GDP, Interest Rates, Inflation (CPI/PPI), Employment
- **Stock traders**: GDP, Earnings Reports, Fed Announcements
- **Crypto traders**: Inflation, Interest Rates, Dollar Index

### 2. Learn the Release Schedule
Spend a week observing:
- When releases happen
- How markets react
- Which releases have biggest impact

### 3. Practice
- Use a demo/paper trading account first
- Test your strategy with small positions
- Track your results

### 4. Integrate with Your Workflow
- Use Insights API to feed data to your trading system
- Set up webhooks to your notification system
- Export data to your analysis tools

## Common Misconceptions

### ❌ "This will make me money automatically"
**Reality**: Insights is a data tool. YOU make trading decisions and execute trades on your own platform.

### ❌ "I need to allocate ETH/USDC to this app"
**Reality**: Insights has no wallet, no blockchain integration, no token requirements. It's a web application.

### ❌ "I need gas fees to use this"
**Reality**: No gas fees. You may need a paid subscription plan for higher API limits, but there are no blockchain transactions.

### ❌ "This is a trading bot"
**Reality**: This is an information and alert system. It provides data; you make decisions.

## Billing and Plans

Insights offers different subscription tiers for API access:

- **Free Tier**: Basic calendar access, limited API calls
- **Plus Plan**: Higher API limits, priority support
- **Pro Plan**: Unlimited API calls, webhook support
- **Enterprise**: Custom limits, dedicated support

Visit **Settings** → **Billing** to view and manage your subscription.

## Getting Help

- **Documentation**: Check `README.md`, `SPEC.md`, and `DEPLOY.md` in the repository
- **API Docs**: Visit `/docs` on your deployed application
- **Issues**: Report bugs or request features on GitHub Issues

## Summary

Insights is your **data companion** for macro trading:
- ✅ Tracks economic releases
- ✅ Alerts you to important data
- ✅ Provides historical context
- ✅ Offers API access for integration

But it does NOT:
- ❌ Execute trades
- ❌ Manage your capital
- ❌ Connect to exchanges
- ❌ Require crypto allocations

**To generate profit from macroeconomic trading**:
1. Use Insights to track and get alerted about releases
2. Analyze the data and market context
3. Execute trades manually on your broker/exchange
4. Apply proper risk management
5. Keep refining your strategy

Think of Insights as your **economic calendar and alert system** - the starting point of your trading workflow, not the end-to-end solution.
