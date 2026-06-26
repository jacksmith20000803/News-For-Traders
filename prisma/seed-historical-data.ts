import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const SYMBOLS = [
  { symbol: 'BTC/USD', assetType: 'crypto', basePrice: 67000 },
  { symbol: 'ETH/USD', assetType: 'crypto', basePrice: 3450 },
  { symbol: 'SOL/USD', assetType: 'crypto', basePrice: 145 },
  { symbol: 'XRP/USD', assetType: 'crypto', basePrice: 0.52 },
  { symbol: 'ADA/USD', assetType: 'crypto', basePrice: 0.45 },
  { symbol: 'DOGE/USD', assetType: 'crypto', basePrice: 0.12 },
];

async function seedHistoricalData() {
  console.log('Starting historical data seed...');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // 30 days of historical data

  for (const { symbol, assetType, basePrice } of SYMBOLS) {
    console.log(`Seeding data for ${symbol}...`);
    
    let currentPrice = basePrice;
    const batchSize = 100;
    
    for (let i = 0; i < 30 * 24; i += batchSize) {
      const dataPoints = [];
      const endIndex = Math.min(i + batchSize, 30 * 24);
      
      for (let j = i; j < endIndex; j++) {
        const timestamp = new Date(startDate);
        timestamp.setHours(timestamp.getHours() + j);
        
        // Simulate price movement with random walk
        const change = (Math.random() - 0.5) * (basePrice * 0.02);
        currentPrice = Math.max(currentPrice + change, basePrice * 0.5);
        currentPrice = Math.min(currentPrice, basePrice * 1.5);
        
        dataPoints.push({
          symbol,
          assetType,
          price: currentPrice,
          timestamp,
        });
      }

      // Batch insert
      try {
        await prisma.priceHistory.createMany({
          data: dataPoints,
          skipDuplicates: true,
        });
      } catch (error) {
        console.error(`Error inserting batch for ${symbol}:`, error);
      }
    }

    // Update or create market quote
    await prisma.marketQuote.upsert({
      where: {
        symbol_assetType: {
          symbol,
          assetType,
        },
      },
      update: {
        price: currentPrice,
        change: (currentPrice - basePrice) / basePrice * 100,
        changePercent: ((currentPrice - basePrice) / basePrice) * 100,
        updatedAt: new Date(),
      },
      create: {
        symbol,
        assetType,
        name: symbol.split('/')[0],
        price: currentPrice,
        change: (currentPrice - basePrice) / basePrice * 100,
        changePercent: ((currentPrice - basePrice) / basePrice) * 100,
        providerName: 'seeded',
      },
    });

    console.log(`Seeded data for ${symbol}`);
  }

  console.log('Historical data seed completed!');
}

seedHistoricalData()
  .catch((e) => {
    console.error('Error seeding historical data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
