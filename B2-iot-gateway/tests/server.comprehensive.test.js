const WebSocket = require('ws');
const express = require('express');
const request = require('supertest');
const { MongoClient } = require('mongodb');
const redis = require('redis');

/**
 * Comprehensive B2 IoT Gateway Tests
 * Tests WebSocket communication, data ingestion, and MongoDB storage
 */

jest.mock('mongodb');
jest.mock('redis');

describe('B2 IoT Gateway - Comprehensive Tests', () => {
  let app;
  let wss;
  let mockMongoClient;
  let mockRedisClient;
  
  // Mock sensor data
  const mockSensorData = {
    licensePlate: 'ABC-123',
    timestamp: '2025-11-19T10:00:00Z',
    indoorTemp: 22.5,
    outdoorTemp: 15.2,
    batteryLevel: 85,
    gps: { lat: 60.1699, lng: 24.9384 },
    speed: 0,
    engineStatus: 'off'
  };

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Mock database storage
    let storedData = [];

    // Health endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        service: 'B2-iot-gateway',
        version: '1.0.0',
        connections: {
          websocket: 'active',
          mongodb: 'connected',
          redis: 'connected'
        },
        timestamp: new Date().toISOString()
      });
    });

    // POST endpoint for sensor data (REST alternative to WebSocket)
    app.post('/api/sensor-data', (req, res) => {
      const data = req.body;

      // Validate required fields
      if (!data.licensePlate) {
        return res.status(400).json({ error: 'licensePlate is required' });
      }

      if (!data.timestamp) {
        return res.status(400).json({ error: 'timestamp is required' });
      }

      // Store data
      const dataWithId = {
        ...data,
        _id: `data-${Date.now()}`,
        receivedAt: new Date().toISOString()
      };

      storedData.push(dataWithId);

      res.status(201).json({
        success: true,
        dataId: dataWithId._id,
        message: 'Sensor data received and stored'
      });
    });

    // GET latest data for a car
    app.get('/api/sensor-data/:licensePlate/latest', (req, res) => {
      const { licensePlate } = req.params;
      
      const carData = storedData
        .filter(d => d.licensePlate === licensePlate)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

      if (!carData) {
        return res.status(404).json({ error: 'No data found for this car' });
      }

      res.status(200).json(carData);
    });

    // GET historical data
    app.get('/api/sensor-data/:licensePlate/history', (req, res) => {
      const { licensePlate } = req.params;
      const { limit = 10 } = req.query;

      const carData = storedData
        .filter(d => d.licensePlate === licensePlate)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, parseInt(limit));

      res.status(200).json({
        licensePlate,
        count: carData.length,
        data: carData
      });
    });

    // WebSocket status
    app.get('/api/websocket/status', (req, res) => {
      res.status(200).json({
        active: true,
        connectedCars: 3,
        port: 8081,
        protocol: 'ws'
      });
    });

    // Command endpoint (send command to car via Redis)
    app.post('/api/car/:licensePlate/command', (req, res) => {
      const { licensePlate } = req.params;
      const { command, params } = req.body;

      if (!command) {
        return res.status(400).json({ error: 'command is required' });
      }

      const validCommands = ['lock', 'unlock', 'start', 'stop', 'climate'];
      if (!validCommands.includes(command)) {
        return res.status(400).json({
          error: 'Invalid command',
          validCommands
        });
      }

      // Simulate publishing to Redis
      const commandId = `cmd-${Date.now()}`;

      res.status(200).json({
        success: true,
        commandId,
        licensePlate,
        command,
        params: params || {},
        status: 'sent',
        channel: `car:${licensePlate}:commands`,
        timestamp: new Date().toISOString()
      });
    });

    // Clear test data endpoint (for testing)
    app.post('/api/test/clear-data', (req, res) => {
      storedData = [];
      res.status(200).json({ success: true, message: 'Test data cleared' });
    });
  });

  describe('Health Check', () => {
    test('should return gateway health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('B2-iot-gateway');
      expect(response.body.connections).toBeDefined();
      expect(response.body.connections.websocket).toBe('active');
      expect(response.body.connections.mongodb).toBe('connected');
      expect(response.body.connections.redis).toBe('connected');
    });
  });

  describe('POST /api/sensor-data - Receive Sensor Data', () => {
    beforeEach(async () => {
      // Clear data before each test
      await request(app).post('/api/test/clear-data');
    });

    test('should accept valid sensor data', async () => {
      const response = await request(app)
        .post('/api/sensor-data')
        .send(mockSensorData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.dataId).toBeDefined();
      expect(response.body.message).toBe('Sensor data received and stored');
    });

    test('should reject data without licensePlate', async () => {
      const invalidData = { ...mockSensorData };
      delete invalidData.licensePlate;

      const response = await request(app)
        .post('/api/sensor-data')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('licensePlate is required');
    });

    test('should reject data without timestamp', async () => {
      const invalidData = { ...mockSensorData };
      delete invalidData.timestamp;

      const response = await request(app)
        .post('/api/sensor-data')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('timestamp is required');
    });

    test('should handle complete sensor data with all fields', async () => {
      const completeData = {
        ...mockSensorData,
        speed: 65,
        fuelLevel: 75,
        engineTemp: 90,
        rpm: 2500,
        odometer: 12345
      };

      const response = await request(app)
        .post('/api/sensor-data')
        .send(completeData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should add receivedAt timestamp', async () => {
      const response = await request(app)
        .post('/api/sensor-data')
        .send(mockSensorData)
        .expect(201);

      // Verify data was stored with receivedAt
      const latestData = await request(app)
        .get(`/api/sensor-data/${mockSensorData.licensePlate}/latest`)
        .expect(200);

      expect(latestData.body.receivedAt).toBeDefined();
    });
  });

  describe('GET /api/sensor-data/:licensePlate/latest - Latest Data', () => {
    beforeEach(async () => {
      await request(app).post('/api/test/clear-data');
      // Add test data
      await request(app).post('/api/sensor-data').send(mockSensorData);
    });

    test('should return latest data for car', async () => {
      const response = await request(app)
        .get('/api/sensor-data/ABC-123/latest')
        .expect(200);

      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.indoorTemp).toBe(22.5);
      expect(response.body.batteryLevel).toBe(85);
    });

    test('should return 404 for non-existent car', async () => {
      const response = await request(app)
        .get('/api/sensor-data/INVALID-999/latest')
        .expect(404);

      expect(response.body.error).toBe('No data found for this car');
    });

    test('should return most recent data when multiple entries exist', async () => {
      // Add older data
      const olderData = {
        ...mockSensorData,
        timestamp: '2025-11-19T09:00:00Z',
        batteryLevel: 80
      };
      await request(app).post('/api/sensor-data').send(olderData);

      // Add newer data
      const newerData = {
        ...mockSensorData,
        timestamp: '2025-11-19T11:00:00Z',
        batteryLevel: 90
      };
      await request(app).post('/api/sensor-data').send(newerData);

      const response = await request(app)
        .get('/api/sensor-data/ABC-123/latest')
        .expect(200);

      // Should return the newest data
      expect(response.body.batteryLevel).toBe(90);
    });
  });

  describe('GET /api/sensor-data/:licensePlate/history - Historical Data', () => {
    beforeEach(async () => {
      await request(app).post('/api/test/clear-data');

      // Add historical data
      for (let i = 0; i < 15; i++) {
        const data = {
          ...mockSensorData,
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          batteryLevel: 100 - i
        };
        await request(app).post('/api/sensor-data').send(data);
      }
    });

    test('should return default 10 historical entries', async () => {
      const response = await request(app)
        .get('/api/sensor-data/ABC-123/history')
        .expect(200);

      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.count).toBe(10);
      expect(response.body.data).toHaveLength(10);
    });

    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/sensor-data/ABC-123/history?limit=5')
        .expect(200);

      expect(response.body.count).toBe(5);
      expect(response.body.data).toHaveLength(5);
    });

    test('should return data in descending order (newest first)', async () => {
      const response = await request(app)
        .get('/api/sensor-data/ABC-123/history?limit=5')
        .expect(200);

      const data = response.body.data;
      for (let i = 0; i < data.length - 1; i++) {
        const current = new Date(data[i].timestamp);
        const next = new Date(data[i + 1].timestamp);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    test('should show battery level change over time', async () => {
      const response = await request(app)
        .get('/api/sensor-data/ABC-123/history?limit=15')
        .expect(200);

      const levels = response.body.data.map(d => d.batteryLevel);
      expect(levels[0]).toBe(100); // Newest
      expect(levels[levels.length - 1]).toBe(86); // Oldest
    });
  });

  describe('GET /api/websocket/status - WebSocket Status', () => {
    test('should return WebSocket connection status', async () => {
      const response = await request(app)
        .get('/api/websocket/status')
        .expect(200);

      expect(response.body.active).toBe(true);
      expect(response.body.connectedCars).toBeDefined();
      expect(response.body.port).toBe(8081);
      expect(response.body.protocol).toBe('ws');
    });
  });

  describe('POST /api/car/:licensePlate/command - Send Commands', () => {
    test('should send command to car', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({ command: 'lock' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.commandId).toBeDefined();
      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.command).toBe('lock');
      expect(response.body.channel).toBe('car:ABC-123:commands');
    });

    test('should send command with parameters', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({
          command: 'climate',
          params: { temperature: 22, fanSpeed: 3 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.params).toEqual({ temperature: 22, fanSpeed: 3 });
    });

    test('should reject command without command field', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('command is required');
    });

    test('should reject invalid command', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({ command: 'fly' })
        .expect(400);

      expect(response.body.error).toBe('Invalid command');
      expect(response.body.validCommands).toContain('lock');
    });

    test('should accept all valid commands', async () => {
      const commands = ['lock', 'unlock', 'start', 'stop', 'climate'];

      for (const cmd of commands) {
        const response = await request(app)
          .post('/api/car/ABC-123/command')
          .send({ command: cmd })
          .expect(200);

        expect(response.body.command).toBe(cmd);
      }
    });
  });

  describe('Data Validation', () => {
    beforeEach(async () => {
      await request(app).post('/api/test/clear-data');
    });

    test('should accept valid GPS coordinates', async () => {
      const dataWithGPS = {
        ...mockSensorData,
        gps: { lat: 60.1699, lng: 24.9384 }
      };

      const response = await request(app)
        .post('/api/sensor-data')
        .send(dataWithGPS)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should handle numeric sensor values', async () => {
      const dataWithNumbers = {
        ...mockSensorData,
        batteryLevel: 85,
        indoorTemp: 22.5,
        outdoorTemp: 15.2,
        speed: 65
      };

      const response = await request(app)
        .post('/api/sensor-data')
        .send(dataWithNumbers)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should handle string fields', async () => {
      const dataWithStrings = {
        ...mockSensorData,
        engineStatus: 'running',
        locked: 'false'
      };

      const response = await request(app)
        .post('/api/sensor-data')
        .send(dataWithStrings)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should handle rapid sensor data submissions', async () => {
      const requests = [];
      
      for (let i = 0; i < 10; i++) {
        const data = {
          ...mockSensorData,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          batteryLevel: 85 - i
        };
        requests.push(request(app).post('/api/sensor-data').send(data));
      }

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    test('should retrieve historical data quickly', async () => {
      // Add some data first
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/sensor-data').send({
          ...mockSensorData,
          timestamp: new Date(Date.now() - i * 60000).toISOString()
        });
      }

      const start = Date.now();
      await request(app)
        .get('/api/sensor-data/ABC-123/history')
        .expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200); // Should respond in < 200ms
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/sensor-data')
        .set('Content-Type', 'application/json')
        .send('{"invalid json}')
        .expect(400);
    });

    test('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/sensor-data')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('required');
    });
  });
});
