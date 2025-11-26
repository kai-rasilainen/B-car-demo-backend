/**
 * MockPressureProvider - Generates realistic tire pressure data for testing
 * This allows B1 development without dependency on Agent C sensors or databases
 */

class MockPressureProvider {
  /**
   * Get current tire pressure readings for a car
   * @param {string} carId - The car identifier
   * @returns {object} Current pressure data with small variations
   */
  static getCurrentPressure(carId) {
    const basePressure = 2.2; // bar (normal pressure)
    const variation = () => (Math.random() - 0.5) * 0.2; // ±0.1 bar variation
    
    return {
      carId,
      timestamp: new Date().toISOString(),
      pressures: {
        frontLeft: parseFloat((basePressure + variation()).toFixed(2)),
        frontRight: parseFloat((basePressure + variation()).toFixed(2)),
        rearLeft: parseFloat((basePressure + variation()).toFixed(2)),
        rearRight: parseFloat((basePressure + variation()).toFixed(2))
      },
      unit: 'bar'
    };
  }

  /**
   * Get historical tire pressure readings for a car
   * @param {string} carId - The car identifier
   * @param {number} days - Number of days of history (default: 7)
   * @returns {array} Array of historical pressure readings
   */
  static getHistoricalPressure(carId, days = 7) {
    const history = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const basePressure = 2.2;
    
    // Generate 4 readings per day
    for (let i = 0; i < days * 4; i++) {
      const timestamp = new Date(now - (i * dayMs / 4));
      const variation = () => (Math.random() - 0.5) * 0.2;
      
      history.push({
        carId,
        timestamp: timestamp.toISOString(),
        pressures: {
          frontLeft: parseFloat((basePressure + variation()).toFixed(2)),
          frontRight: parseFloat((basePressure + variation()).toFixed(2)),
          rearLeft: parseFloat((basePressure + variation()).toFixed(2)),
          rearRight: parseFloat((basePressure + variation()).toFixed(2))
        },
        unit: 'bar'
      });
    }
    
    return history.reverse(); // Return oldest first
  }
}

module.exports = MockPressureProvider;
