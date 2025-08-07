# Polymarket Realtime Monitor

A memory-optimized real-time WebSocket client that monitors Polymarket trades and saves high-confidence predictions to Airtable.

## Project Structure

```
├── app.ts                     # Main application entry point
├── lib/                       # Core libraries
│   ├── airtable.ts           # Airtable database operations
│   ├── polymarket.ts         # Polymarket API client
│   └── websocket/            # WebSocket client library
│       ├── client.ts         # WebSocket client implementation
│       ├── index.ts          # Library exports
│       └── model.ts          # Type definitions
├── utils/                     # Utility functions
│   ├── memory.ts             # Memory monitoring and cleanup
│   └── time.ts               # Time parsing and comparison
├── scripts/                   # Standalone scripts
│   └── update-winners.ts     # Script to update market winners
├── start.sh                  # Memory-optimized startup script
└── package.json              # Project configuration
```

## Quick VPS Deployment

1. **Clone the repository on your VPS:**
   ```bash
   git clone https://github.com/lucasespinosa28/realtime.git
   cd realtime
   ```

2. **Run the setup script:**
   ```bash
   ./setup.sh
   ```

3. **Configure your environment:**
   ```bash
   nano .env
   # Add your Airtable API_KEY and BASE_ID
   ```

4. **Start the application:**
   ```bash
   ./start.sh
   ```

5. **Run in background (optional):**
   ```bash
   nohup ./start.sh > app.log 2>&1 &
   ```

## Environment Variables

```bash
BASE_ID=your_airtable_base_id
API_KEY=your_airtable_api_key
```

## Usage

### Quick Start (Production)
```bash
./start.sh
```

### Run in Background
```bash
nohup ./start.sh > app.log 2>&1 &
```

### Development Mode
```bash
bun run dev
```

### Update Market Winners

```bash
bun run update-winners
```

## Memory Optimizations

- **Set-based Caching**: O(1) duplicate detection instead of array searches
- **Limited Cache Size**: Maximum 32 recent IDs to prevent memory growth
- **Periodic Cleanup**: Automatic cache clearing and garbage collection
- **Message Filtering**: Early returns to minimize processing overhead
- **Connection Cleanup**: Proper WebSocket cleanup to prevent memory leaks
- **Exponential Backoff**: Smart reconnection strategy to prevent resource waste

## API

### Libraries

- `lib/airtable.ts`: Database operations (create, update, select)
- `lib/polymarket.ts`: Market data fetching and winner detection
- `lib/websocket/`: WebSocket client for real-time data

### Utilities

- `utils/memory.ts`: Memory monitoring and cleanup functions
- `utils/time.ts`: Time parsing and comparison utilities

### Scripts

- `scripts/update-winners.ts`: Batch update market winners

## Configuration

The application is configured for low-memory environments:
- Memory monitoring every 60 seconds
- Garbage collection triggered at 100MB heap usage
- Cache limited to 32 recent trade IDs
- Exponential backoff for reconnections (max 10 attempts)

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.0. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
