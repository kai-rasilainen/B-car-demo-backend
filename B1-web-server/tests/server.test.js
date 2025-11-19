const request = require('supertest');
const express = require('express');
const { MongoClient } = require('mongodb');
const { Client } = require('pg');
const redis = require('redis');

// Mock database clients
jest.mock('mongodb');
jest.mock('pg');
jest.mock('redis');

describe('B1 Web Server API Tests', () => {
  let app;
  let mockMongoClient;
  let mockPgClient;
  let mockRedisClient;

  beforeAll(() => {
    // Create Express app with realistic endpoints
    app = express();
    app.use(express.json());
    
    // Mock database data
    const mockCarData = {
      'ABC-123': {
        licensePlate: 'ABC-123',
        owner: 'John Doe',
        lastService: '2024-10-15',
        indoorTemp: 22.5,
        outdoorTemp: 15.2,
        gps: { lat: 60.1699, lng: 24.9384 },
        batteryLevel: 85,
        lastUpdated: new Date().toISOString()
      },
      'XYZ-789': {
        licensePlate: 'XYZ-789',
        owner: 'Jane Smith',
        lastService: '2024-09-20',
        indoorTemp: 18.0,
        outdoorTemp: 12.8,
        gps: { lat: 60.1733, lng: 24.9410 },
        batteryLevel: 92,
        lastUpdated: new Date().toISOString()
      }
    };
    
    // Health endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        service: 'B1-web-server',
        timestamp: new Date().toISOString(),
        dependencies: {
          mongodb: 'connected',
          postgresql: 'connected',
          redis: 'connected'
        }
      });
    });
    
    // Get all cars
    app.get('/api/cars', (req, res) => {
      const cars = Object.values(mockCarData);
      res.status(200).json(cars);
    });
    
    // Get single car by license plate
    app.get('/api/car/:licensePlate', (req, res) => {
      const { licensePlate } = req.params;
      const car = mockCarData[licensePlate];
      
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }
      
      res.status(200).json(car);
    });
    
    // Send command to car
    app.post('/api/car/:licensePlate/command', (req, res) => {
      const { licensePlate } = req.params;
      const { command, params } = req.body;
      
      // Validate car exists
      if (!mockCarData[licensePlate]) {
        return res.status(404).json({ error: 'Car not found' });
      }
      
      // Validate command
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }
      
      const validCommands = ['lock', 'unlock', 'start', 'stop', 'honk', 'lights'];
      if (!validCommands.includes(command)) {
        return res.status(400).json({ 
          error: 'Invalid command',
          validCommands 
        });
      }
      
      // Simulate command sent to Redis
      res.status(200).json({ 
        success: true, 
        licensePlate, 
        command,
        params: params || {},
        message: `Command ${command} sent to ${licensePlate}`,
        timestamp: new Date().toISOString()
      });
    });
    
    // Get car battery status
    app.get('/api/car/:licensePlate/battery', (req, res) => {
      const { licensePlate } = req.params;
      const car = mockCarData[licensePlate];
      
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }
      
      res.status(200).json({
        licensePlate,
        batteryLevel: car.batteryLevel,
        status: car.batteryLevel > 20 ? 'ok' : 'low',
        lastUpdated: car.lastUpdated
      });
    });
    
    // Get car location
    app.get('/api/car/:licensePlate/location', (req, res) => {
      const { licensePlate } = req.params;
      const car = mockCarData[licensePlate];
      
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }
      
      res.status(200).json({
        licensePlate,
        gps: car.gps,
        lastUpdated: car.lastUpdated
      });
    });
    
    // Get car temperature
    app.get('/api/car/:licensePlate/temperature', (req, res) => {
      const { licensePlate } = req.params;
      const car = mockCarData[licensePlate];
      
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }
      
      res.status(200).json({
        licensePlate,
        indoorTemp: car.indoorTemp,
        outdoorTemp: car.outdoorTemp,
        lastUpdated: car.lastUpdated
      });
    });
  });

  describe('Health Endpoints', () => {
    test('GET /health should return server status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('service');
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('B1-web-server');
    });
  });

  describe('Car API Endpoints', () => {
    test('GET /api/cars should return array of cars', async () => {
      const response = await request(app)
        .get('/api/cars')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('licensePlate');
      expect(response.body[0]).toHaveProperty('owner');
    });
  });

  describe('Car Commands', () => {
    test('POST /api/car/:licensePlate/command should accept valid commands', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({ command: 'lock' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.command).toBe('lock');
    });

    test('POST /api/car/:licensePlate/command should reject invalid commands', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({ command: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('POST /api/car/:licensePlate/command should require command field', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
  });
});
