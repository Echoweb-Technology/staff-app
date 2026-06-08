module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    'react-dom': '<rootDir>/__mocks__/react-dom.js', // Mock react-dom
  },
};
