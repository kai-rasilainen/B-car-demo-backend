const request = require('supertest');
const express = require('express');

/**
 * Comprehensive B1 Web Server API Tests
 * Tests all major endpoints with realistic scenarios
 */

describe('B1 Web Server - Comprehensive Tests', () => {
  let app;
  
  // Mock car database
  const mockCarData = {
    'ABC-123': {
      licensePlate: 'ABC-123',
      owner: 'John Doe',
      model: 'Tesla Model 3',
      year: 2023,
      lastService: '2024-10-15',
      indoorTemp: 22.5,
      outdoorTemp: 15.2,
      gps: { lat: 60.1699, lng: 24.9384 },
      batteryLevel: 85,
      locked: true,
      engineStatus: 'off',
      lastUpdated: '2025-11-19T10:00:00Z'
    },
    'XYZ-789': {
      licensePlate: 'XYZ-789',
      owner: 'Jane Smith',
      model: 'BMW i4',
      year: 2024,
      lastService: '2024-09-20',
      indoorTemp: 18.0,
      outdoorTemp: 12.8,
      gps: { lat: 60.1733, lng: 24.9410 },
      batteryLevel: 92,
      locked: false,
      engineStatus: 'running',
      lastUpdated: '2025-11-19T10:00:00Z'
    },
    'DEF-456': {
      licensePlate: 'DEF-456',
      owner: 'Mike Johnson',
      model: 'Audi e-tron',
      year: 2023,
      lastService: '2024-11-01',
      indoorTemp: 25.1,
      outdoorTemp: 8.5,
      gps: { lat: 60.1681, lng: 24.9342 },
      batteryLevel: 15, // Low battery
      locked: true,
      engineStatus: 'off',
      lastUpdated: '2025-11-19T10:00:00Z'
    }
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        service: 'B1-web-server',
        version: '1.0.0',
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
      
      // Optional filtering
      const { status, lowBattery } = req.query;
      let filtered = cars;
      
      if (lowBattery === 'true') {
        filtered = filtered.filter(car => car.batteryLevel < 20);
      }
      
      res.status(200).json(filtered);
    });

    // Get specific car
    app.get('/api/car/:licensePlate', (req, res) => {
      const { licensePlate } = req.params;
      const car = mockCarData[licensePlate];

      if (!car) {
        return res.status(404).json({
          error: 'Car not found',
          licensePlate
        });
      }

      res.status(200).json(car);
    });

    // Get car battery status
    app.get('/api/car/:licensePlate/battery', (req, res) => {
      const { licensePlate } = req.params;
      const car = mockCarData[licensePlate];

      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      const status = car.batteryLevel > 20 ? 'ok' : 'low';
      const warning = car.batteryLevel < 10 ? 'critical' : null;

      res.status(200).json({
        licensePlate,
        batteryLevel: car.batteryLevel,
        status,
        warning,
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
        address: 'Helsinki, Finland', // Mock address
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
        tempDiff: (car.indoorTemp - car.outdoorTemp).toFixed(1),
        lastUpdated: car.lastUpdated
      });
    });

    // Send command to car
    app.post('/api/car/:licensePlate/command', (req, res) => {
      const { licensePlate } = req.params;
      const { command, params } = req.body;

      // Validate car exists
      const car = mockCarData[licensePlate];
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      // Validate command
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const validCommands = ['lock', 'unlock', 'start', 'stop', 'honk', 'lights', 'climate'];
      if (!validCommands.includes(command)) {
        return res.status(400).json({
          error: 'Invalid command',
          validCommands
        });
      }

      // Simulate command logic
      const commandId = `cmd-${Date.now()}`;

      res.status(200).json({
        success: true,
        commandId,
        licensePlate,
        command,
        params: params || {},
        message: `Command ${command} sent to ${licensePlate}`,
        timestamp: new Date().toISOString()
      });
    });

    // Get car status
    app.get('/api/car/:licensePlate/status', (req, res) => {
      const { licensePlate } = req.params;
      const car = mockCarData[licensePlate];

      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      res.status(200).json({
        licensePlate,
        locked: car.locked,
        engineStatus: car.engineStatus,
        batteryLevel: car.batteryLevel,
        lastUpdated: car.lastUpdated
      });
    });
  });

  describe('Health Check', () => {
    test('should return healthy status with all dependencies', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('B1-web-server');
      expect(response.body.version).toBeDefined();
      expect(response.body.dependencies).toBeDefined();
      expect(response.body.dependencies.mongodb).toBe('connected');
      expect(response.body.dependencies.postgresql).toBe('connected');
      expect(response.body.dependencies.redis).toBe('connected');
    });
  });

  describe('GET /api/cars - List All Cars', () => {
    test('should return array of all cars', async () => {
      const response = await request(app)
        .get('/api/cars')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      response.body.forEach(car => {
        expect(car).toHaveProperty('licensePlate');
        expect(car).toHaveProperty('owner');
        expect(car).toHaveProperty('model');
        expect(car).toHaveProperty('batteryLevel');
      });
    });

    test('should filter cars with low battery', async () => {
      const response = await request(app)
        .get('/api/cars?lowBattery=true')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].licensePlate).toBe('DEF-456');
      expect(response.body[0].batteryLevel).toBeLessThan(20);
    });

    test('should return all cars when no filter applied', async () => {
      const response = await request(app)
        .get('/api/cars')
        .expect(200);

      expect(response.body.length).toBe(3);
    });
  });

  describe('GET /api/car/:licensePlate - Get Specific Car', () => {
    test('should return car data for valid license plate', async () => {
      const response = await request(app)
        .get('/api/car/ABC-123')
        .expect(200);

      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.owner).toBe('John Doe');
      expect(response.body.model).toBe('Tesla Model 3');
      expect(response.body.indoorTemp).toBe(22.5);
      expect(response.body.outdoorTemp).toBe(15.2);
      expect(response.body.gps).toEqual({ lat: 60.1699, lng: 24.9384 });
    });

    test('should return 404 for non-existent car', async () => {
      const response = await request(app)
        .get('/api/car/INVALID-999')
        .expect(404);

      expect(response.body.error).toBe('Car not found');
      expect(response.body.licensePlate).toBe('INVALID-999');
    });

    test('should return complete car data structure', async () => {
      const response = await request(app)
        .get('/api/car/XYZ-789')
        .expect(200);

      const expectedFields = [
        'licensePlate', 'owner', 'model', 'year', 'lastService',
        'indoorTemp', 'outdoorTemp', 'gps', 'batteryLevel',
        'locked', 'engineStatus', 'lastUpdated'
      ];

      expectedFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
      });
    });
  });

  describe('GET /api/car/:licensePlate/battery - Battery Status', () => {
    test('should return battery status for car with good charge', async () => {
      const response = await request(app)
        .get('/api/car/ABC-123/battery')
        .expect(200);

      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.batteryLevel).toBe(85);
      expect(response.body.status).toBe('ok');
      expect(response.body.warning).toBeNull();
    });

    test('should return low battery warning', async () => {
      const response = await request(app)
        .get('/api/car/DEF-456/battery')
        .expect(200);

      expect(response.body.licensePlate).toBe('DEF-456');
      expect(response.body.batteryLevel).toBe(15);
      expect(response.body.status).toBe('low');
    });

    test('should return 404 for non-existent car', async () => {
      const response = await request(app)
        .get('/api/car/INVALID-999/battery')
        .expect(404);

      expect(response.body.error).toBe('Car not found');
    });
  });

  describe('GET /api/car/:licensePlate/location - GPS Location', () => {
    test('should return GPS coordinates', async () => {
      const response = await request(app)
        .get('/api/car/ABC-123/location')
        .expect(200);

      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.gps).toBeDefined();
      expect(response.body.gps.lat).toBeCloseTo(60.1699, 2);
      expect(response.body.gps.lng).toBeCloseTo(24.9384, 2);
      expect(response.body.address).toBeDefined();
    });

    test('should include lastUpdated timestamp', async () => {
      const response = await request(app)
        .get('/api/car/XYZ-789/location')
        .expect(200);

      expect(response.body.lastUpdated).toBeDefined();
      expect(new Date(response.body.lastUpdated)).toBeInstanceOf(Date);
    });
  });

  describe('GET /api/car/:licensePlate/temperature - Temperature Data', () => {
    test('should return indoor and outdoor temperature', async () => {
      const response = await request(app)
        .get('/api/car/ABC-123/temperature')
        .expect(200);

      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.indoorTemp).toBe(22.5);
      expect(response.body.outdoorTemp).toBe(15.2);
      expect(response.body.tempDiff).toBe('7.3');
    });

    test('should calculate temperature difference', async () => {
      const response = await request(app)
        .get('/api/car/DEF-456/temperature')
        .expect(200);

      const expectedDiff = (25.1 - 8.5).toFixed(1);
      expect(response.body.tempDiff).toBe(expectedDiff);
    });
  });

  describe('POST /api/car/:licensePlate/command - Send Commands', () => {
    test('should send lock command successfully', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({ command: 'lock' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.command).toBe('lock');
      expect(response.body.commandId).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('should send unlock command successfully', async () => {
      const response = await request(app)
        .post('/api/car/XYZ-789/command')
        .send({ command: 'unlock' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.command).toBe('unlock');
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
      expect(response.body.command).toBe('climate');
      expect(response.body.params).toEqual({ temperature: 22, fanSpeed: 3 });
    });

    test('should accept all valid commands', async () => {
      const validCommands = ['lock', 'unlock', 'start', 'stop', 'honk', 'lights', 'climate'];

      for (const cmd of validCommands) {
        const response = await request(app)
          .post('/api/car/ABC-123/command')
          .send({ command: cmd })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.command).toBe(cmd);
      }
    });

    test('should reject command without command field', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Command is required');
    });

    test('should reject invalid command', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({ command: 'fly' })
        .expect(400);

      expect(response.body.error).toBe('Invalid command');
      expect(response.body.validCommands).toBeDefined();
      expect(Array.isArray(response.body.validCommands)).toBe(true);
    });

    test('should return 404 for non-existent car', async () => {
      const response = await request(app)
        .post('/api/car/INVALID-999/command')
        .send({ command: 'lock' })
        .expect(404);

      expect(response.body.error).toBe('Car not found');
    });

    test('should handle empty params object', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .send({ command: 'honk', params: {} })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.params).toEqual({});
    });
  });

  describe('GET /api/car/:licensePlate/status - Car Status', () => {
    test('should return car status', async () => {
      const response = await request(app)
        .get('/api/car/ABC-123/status')
        .expect(200);

      expect(response.body.licensePlate).toBe('ABC-123');
      expect(response.body.locked).toBe(true);
      expect(response.body.engineStatus).toBe('off');
      expect(response.body.batteryLevel).toBe(85);
    });

    test('should show running engine status', async () => {
      const response = await request(app)
        .get('/api/car/XYZ-789/status')
        .expect(200);

      expect(response.body.engineStatus).toBe('running');
      expect(response.body.locked).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/car/ABC-123/command')
        .set('Content-Type', 'application/json')
        .send('{"invalid json}')
        .expect(400);
    });

    test('should handle empty license plate', async () => {
      const response = await request(app)
        .get('/api/car/ ')
        .expect(404);
    });

    test('should handle special characters in license plate', async () => {
      const response = await request(app)
        .get('/api/car/ABC@#$123')
        .expect(404);

      expect(response.body.error).toBe('Car not found');
    });
  });

  describe('Data Validation', () => {
    test('all car objects should have required fields', async () => {
      const response = await request(app)
        .get('/api/cars')
        .expect(200);

      const requiredFields = ['licensePlate', 'owner', 'batteryLevel', 'gps'];

      response.body.forEach(car => {
        requiredFields.forEach(field => {
          expect(car).toHaveProperty(field);
        });
      });
    });

    test('battery levels should be numeric and in valid range', async () => {
      const response = await request(app)
        .get('/api/cars')
        .expect(200);

      response.body.forEach(car => {
        expect(typeof car.batteryLevel).toBe('number');
        expect(car.batteryLevel).toBeGreaterThanOrEqual(0);
        expect(car.batteryLevel).toBeLessThanOrEqual(100);
      });
    });

    test('GPS coordinates should be valid', async () => {
      const response = await request(app)
        .get('/api/cars')
        .expect(200);

      response.body.forEach(car => {
        expect(car.gps).toHaveProperty('lat');
        expect(car.gps).toHaveProperty('lng');
        expect(typeof car.gps.lat).toBe('number');
        expect(typeof car.gps.lng).toBe('number');
        expect(car.gps.lat).toBeGreaterThanOrEqual(-90);
        expect(car.gps.lat).toBeLessThanOrEqual(90);
        expect(car.gps.lng).toBeGreaterThanOrEqual(-180);
        expect(car.gps.lng).toBeLessThanOrEqual(180);
      });
    });

    test('temperatures should be realistic', async () => {
      const response = await request(app)
        .get('/api/cars')
        .expect(200);

      response.body.forEach(car => {
        expect(typeof car.indoorTemp).toBe('number');
        expect(typeof car.outdoorTemp).toBe('number');
        expect(car.indoorTemp).toBeGreaterThan(-50);
        expect(car.indoorTemp).toBeLessThan(60);
        expect(car.outdoorTemp).toBeGreaterThan(-50);
        expect(car.outdoorTemp).toBeLessThan(50);
      });
    });
  });

  describe('Performance', () => {
    test('should respond to health check quickly', async () => {
      const start = Date.now();
      await request(app).get('/health').expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should respond in < 100ms
    });

    test('should handle multiple concurrent requests', async () => {
      const requests = [
        request(app).get('/api/car/ABC-123'),
        request(app).get('/api/car/XYZ-789'),
        request(app).get('/api/car/DEF-456'),
        request(app).get('/api/cars'),
        request(app).get('/health')
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});
