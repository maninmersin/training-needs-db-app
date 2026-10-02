/** Unit tests: npm test. (Backend integration: npm run test:local-stack) */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.{js,jsx}', '**/*.test.{js,jsx}'],
  transform: { '^.+\\.(js|jsx)$': 'babel-jest' },
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};
