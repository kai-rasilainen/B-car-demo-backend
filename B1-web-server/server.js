const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { Client } = require('pg');
const redis = require('redis');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const MockPressureProvider = require('./utils/mockPressureProvider');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Car Demo B1 Web Server API',
      version: '1.0.0',
      description: 'REST API for Car Demo System - Web Server providing car data and command interface',
      contact: {
        name: 'API Support',
        email: 'support@cardemo.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints'
      },
      {
        name: 'Cars',
        description: 'Car data and management endpoints'
      },
      {
        name: 'Commands',
        description: 'Send commands to cars'
      }
    ]
  },
  apis: ['./server.js'] // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(cors());
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Database connections
let mongoClient, pgClient, redisClient;

// MongoDB connection (B3 - Real-time data)
const MONGO_URL = process.env.MONGO_URL || 'mongodb://admin:password@localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'cardata';

// PostgreSQL connection (B4 - Static data)
const PG_CONFIG = {
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DB || 'carinfo',
  password: process.env.PG_PASSWORD || 'password',
  port: process.env.PG_PORT || 5432,
};

// Redis connection (C2 communication)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize database connections
async function initDatabases() {
  try {
    // MongoDB
    mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    console.log('Connected to MongoDB');

    // PostgreSQL
    pgClient = new Client(PG_CONFIG);
    await pgClient.connect();
    console.log('Connected to PostgreSQL');

    // Redis
    redisClient = redis.createClient({ url: REDIS_URL });
    await redisClient.connect();
    console.log('Connected to Redis');

  } catch (error) {
    console.error('Database connection error:', error);
    // Continue without databases for demo purposes
  }
}

// Mock data for demo when databases are not available
const mockCarData = {
  'ABC-123': {
    licensePlate: 'ABC-123',
    owner: 'John Doe',
    lastService: '2024-10-15',
    indoorTemp: 22.5,
    outdoorTemp: 15.2,
    gps: { lat: 60.1699, lng: 24.9384 }, // Helsinki
    lastUpdated: new Date().toISOString()
  },
  'XYZ-789': {
    licensePlate: 'XYZ-789',
    owner: 'Jane Smith',
    lastService: '2024-09-20',
    indoorTemp: 18.0,
    outdoorTemp: 12.8,
    gps: { lat: 60.1733, lng: 24.9410 },
    lastUpdated: new Date().toISOString()
  },
  'DEF-456': {
    licensePlate: 'DEF-456',
    owner: 'Mike Johnson',
    lastService: '2024-11-01',
    indoorTemp: 25.1,
    outdoorTemp: 8.5,
    gps: { lat: 60.1681, lng: 24.9342 },
    lastUpdated: new Date().toISOString()
  }
};

/**
 * @swagger
 * /api/car/{licensePlate}:
 *   get:
 *     summary: Get car data by license plate
 *     description: Retrieves real-time and static data for a specific car. Combines data from MongoDB (real-time sensor data) and PostgreSQL (static car information).
 *     tags: [Cars]
 *     parameters:
 *       - in: path
 *         name: licensePlate
 *         required: true
 *         schema:
 *           type: string
 *           example: ABC-123
 *         description: The license plate number of the car
 *     responses:
 *       200:
 *         description: Car data successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 licensePlate:
 *                   type: string
 *                   example: ABC-123
 *                 owner:
 *                   type: string
 *                   example: John Doe
 *                 lastService:
 *                   type: string
 *                   format: date
 *                   example: 2024-10-15
 *                 indoorTemp:
 *                   type: number
 *                   format: float
 *                   example: 23.5
 *                   description: Indoor temperature in Celsius (1 decimal precision)
 *                 outdoorTemp:
 *                   type: number
 *                   format: float
 *                   example: 14.2
 *                   description: Outdoor temperature in Celsius (1 decimal precision)
 *                 gps:
 *                   type: object
 *                   properties:
 *                     lat:
 *                       type: number
 *                       example: 60.1699
 *                     lng:
 *                       type: number
 *                       example: 24.9384
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-11-07T06:49:35.014Z
 *       404:
 *         description: Car not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Car not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
app.get('/api/car/:licensePlate', async (req, res) => {
  try {
    const { licensePlate } = req.params;
    console.log(`Fetching data for license plate: ${licensePlate}`);

    let carData = null;

    if (mongoClient && pgClient) {
      // Get real-time data from MongoDB (B3)
      const db = mongoClient.db(MONGO_DB);
      const realtimeData = await db.collection('car_data').findOne(
        { licensePlate },
        { sort: { timestamp: -1 } }
      );

      // Get static data from PostgreSQL (B4)
      const staticResult = await pgClient.query(
        'SELECT * FROM cars WHERE license_plate = $1',
        [licensePlate]
      );

      if (realtimeData && staticResult.rows.length > 0) {
        const staticData = staticResult.rows[0];
        carData = {
          licensePlate,
          owner: staticData.owner_name,
          lastService: staticData.last_service,
          indoorTemp: parseFloat(realtimeData.indoorTemp.toFixed(1)),
          outdoorTemp: parseFloat(realtimeData.outdoorTemp.toFixed(1)),
          gps: realtimeData.gps,
          lastUpdated: realtimeData.timestamp
        };
      }
    }

    // Fallback to mock data if databases not available or no data found
    if (!carData) {
      carData = mockCarData[licensePlate.toUpperCase()];
      if (carData) {
        // Add some random variation to temperatures for demo
        carData = {
          ...carData,
          indoorTemp: parseFloat((carData.indoorTemp + (Math.random() - 0.5) * 2).toFixed(1)),
          outdoorTemp: parseFloat((carData.outdoorTemp + (Math.random() - 0.5) * 3).toFixed(1)),
          lastUpdated: new Date().toISOString()
        };
      }
    }

    if (!carData) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json(carData);
  } catch (error) {
    console.error('Error fetching car data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/car/{licensePlate}/command:
 *   post:
 *     summary: Send command to a car
 *     description: Sends a command to a specific car via Redis message broker. Commands can control various car functions like AC, engine, locks, etc.
 *     tags: [Commands]
 *     parameters:
 *       - in: path
 *         name: licensePlate
 *         required: true
 *         schema:
 *           type: string
 *           example: ABC-123
 *         description: The license plate number of the car
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - command
 *             properties:
 *               command:
 *                 type: string
 *                 example: start_ac
 *                 description: The command to send to the car
 *                 enum:
 *                   - start_ac
 *                   - stop_ac
 *                   - lock_doors
 *                   - unlock_doors
 *                   - start_engine
 *                   - stop_engine
 *     responses:
 *       200:
 *         description: Command sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Command sent successfully
 *                 command:
 *                   type: string
 *                   example: start_ac
 *                 licensePlate:
 *                   type: string
 *                   example: ABC-123
 *       400:
 *         description: Bad request - missing command
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Command is required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
app.post('/api/car/:licensePlate/command', async (req, res) => {
  try {
    const { licensePlate } = req.params;
    const { command } = req.body;

    console.log(`Sending command "${command}" to car ${licensePlate}`);

    // Try to send command via Redis (C2)
    if (redisClient) {
      const commandData = {
        licensePlate,
        command,
        timestamp: new Date().toISOString()
      };
      
      await redisClient.publish(`car:${licensePlate}:commands`, JSON.stringify(commandData));
      console.log('Command sent via Redis');
    }

    // For demo purposes, always return success
    res.json({ 
      success: true, 
      message: `Command "${command}" sent to car ${licensePlate}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error sending command:', error);
    res.status(500).json({ error: 'Failed to send command' });
  }
});

/**
 * @swagger
 * /api/cars:
 *   get:
 *     summary: Get all cars
 *     description: Retrieves a list of all cars in the system with basic information. Used for staff dashboard.
 *     tags: [Cars]
 *     responses:
 *       200:
 *         description: List of cars successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   licensePlate:
 *                     type: string
 *                     example: ABC-123
 *                   owner:
 *                     type: string
 *                     example: John Doe
 *                   lastService:
 *                     type: string
 *                     format: date
 *                     example: 2024-10-15
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
app.get('/api/cars', async (req, res) => {
  try {
    let cars = [];

    if (pgClient) {
      const result = await pgClient.query('SELECT * FROM cars');
      cars = result.rows.map(row => ({
        licensePlate: row.license_plate,
        owner: row.owner_name,
        lastService: row.last_service
      }));
    } else {
      // Fallback to mock data
      cars = Object.values(mockCarData).map(car => ({
        licensePlate: car.licensePlate,
        owner: car.owner,
        lastService: car.lastService
      }));
    }

    res.json(cars);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the server and all database connections
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 server:
 *                   type: string
 *                   example: ok
 *                 mongodb:
 *                   type: string
 *                   example: connected
 *                 postgresql:
 *                   type: string
 *                   example: connected
 *                 redis:
 *                   type: string
 *                   example: connected
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-11-07T12:00:00.000Z
 */
app.get('/health', (req, res) => {
  const status = {
    server: 'ok',
    mongodb: mongoClient ? 'connected' : 'disconnected',
    postgresql: pgClient ? 'connected' : 'disconnected',
    redis: redisClient ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  };
  res.json(status);
});

/**
 * @swagger
 * /api/monitoring/tire-pressure/{carId}:
 *   get:
 *     summary: Get current tire pressure for a car
 *     description: Returns current tire pressure readings. Uses mock data if USE_MOCK_DATA=true or database unavailable.
 *     tags: [Monitoring]
 *     parameters:
 *       - in: path
 *         name: carId
 *         required: true
 *         schema:
 *           type: string
 *         description: The car identifier
 *     responses:
 *       200:
 *         description: Current tire pressure data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 carId:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 pressures:
 *                   type: object
 *                 unit:
 *                   type: string
 *                 isMockData:
 *                   type: boolean
 */
app.get('/api/monitoring/tire-pressure/:carId', async (req, res) => {
  const { carId } = req.params;
  const useMockData = process.env.USE_MOCK_DATA === 'true';

  try {
    if (useMockData || !mongoClient) {
      // Use mock data
      const mockData = MockPressureProvider.getCurrentPressure(carId);
      return res.json({
        ...mockData,
        isMockData: true
      });
    }

    // Try to get real data from database
    const db = mongoClient.db(MONGO_DB);
    const data = await db.collection('tire_pressure').findOne(
      { carId },
      { sort: { timestamp: -1 } }
    );

    if (data) {
      res.json({
        ...data,
        isMockData: false
      });
    } else {
      // Fallback to mock data if no real data found
      const mockData = MockPressureProvider.getCurrentPressure(carId);
      res.json({
        ...mockData,
        isMockData: true
      });
    }
  } catch (error) {
    console.error('Error fetching tire pressure:', error);
    // Fallback to mock data on error
    const mockData = MockPressureProvider.getCurrentPressure(carId);
    res.json({
      ...mockData,
      isMockData: true
    });
  }
});

/**
 * @swagger
 * /api/monitoring/tire-pressure/{carId}/history:
 *   get:
 *     summary: Get historical tire pressure data for a car
 *     description: Returns tire pressure readings over time. Uses mock data if USE_MOCK_DATA=true or database unavailable.
 *     tags: [Monitoring]
 *     parameters:
 *       - in: path
 *         name: carId
 *         required: true
 *         schema:
 *           type: string
 *         description: The car identifier
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days of history to retrieve
 *     responses:
 *       200:
 *         description: Historical tire pressure data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 carId:
 *                   type: string
 *                 data:
 *                   type: array
 *                 isMockData:
 *                   type: boolean
 */
app.get('/api/monitoring/tire-pressure/:carId/history', async (req, res) => {
  const { carId } = req.params;
  const days = parseInt(req.query.days) || 7;
  const useMockData = process.env.USE_MOCK_DATA === 'true';

  try {
    if (useMockData || !mongoClient) {
      // Use mock data
      const mockData = MockPressureProvider.getHistoricalPressure(carId, days);
      return res.json({
        carId,
        data: mockData,
        isMockData: true
      });
    }

    // Try to get real data from database
    const db = mongoClient.db(MONGO_DB);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const data = await db.collection('tire_pressure')
      .find({
        carId,
        timestamp: { $gte: startDate.toISOString() }
      })
      .sort({ timestamp: 1 })
      .toArray();

    if (data && data.length > 0) {
      res.json({
        carId,
        data,
        isMockData: false
      });
    } else {
      // Fallback to mock data if no real data found
      const mockData = MockPressureProvider.getHistoricalPressure(carId, days);
      res.json({
        carId,
        data: mockData,
        isMockData: true
      });
    }
  } catch (error) {
    console.error('Error fetching tire pressure history:', error);
    // Fallback to mock data on error
    const mockData = MockPressureProvider.getHistoricalPressure(carId, days);
    res.json({
      carId,
      data: mockData,
      isMockData: true
    });
  }
});

// Start server
async function startServer() {
  await initDatabases();
  
  app.listen(PORT, () => {
    console.log(`B1 Web Server API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Car data endpoint: http://localhost:${PORT}/api/car/{licensePlate}`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  if (mongoClient) await mongoClient.close();
  if (pgClient) await pgClient.end();
  if (redisClient) await redisClient.quit();
  process.exit(0);
});

startServer().catch(console.error);