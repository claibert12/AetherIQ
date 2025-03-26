# AetherIQ Frontend

A modern, responsive web dashboard for monitoring and optimizing AI-driven workflows.

## Features

- Real-time workflow performance monitoring
- Interactive charts and visualizations
- Workflow optimization recommendations
- Security alerts and compliance status
- WebSocket-based live updates
- Responsive Material-UI design
- TypeScript support
- Comprehensive error handling

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Backend API running (see backend documentation)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/your-org/aetheriq.git
cd aetheriq/app/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
REACT_APP_API_BASE_URL=http://localhost:8000/api/v1
REACT_APP_WS_BASE_URL=ws://localhost:8000/ws
```

4. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App
- `npm run lint` - Runs ESLint
- `npm run lint:fix` - Fixes ESLint issues
- `npm run format` - Formats code with Prettier

## Project Structure

```
src/
├── api/              # API integration layer
├── components/       # React components
│   └── Dashboard/   # Dashboard components
├── config/          # Configuration files
├── hooks/           # Custom React hooks
├── services/        # Service layer
├── theme/           # Material-UI theme
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## Components

### Dashboard
The main dashboard component that combines all sections:
- Performance Overview
- Workflow Logs
- Security Alerts

### WorkflowPerformance
Displays workflow performance metrics with interactive charts:
- Execution time trends
- Resource usage monitoring
- Optimization recommendations

### WorkflowLogs
Shows detailed workflow execution logs:
- Status indicators
- Execution duration
- Optimization suggestions
- Action buttons

### SecurityAlerts
Real-time security monitoring:
- Active alerts
- Compliance status
- Risk indicators

## API Integration

The application uses Axios for HTTP requests and includes:
- Request/response interceptors
- Error handling
- Authentication token management
- WebSocket connection for real-time updates

## WebSocket Integration

Real-time updates are handled through WebSocket connections:
- Automatic reconnection
- Message subscription system
- Error handling
- Connection state management

## Styling

The application uses Material-UI with a custom theme:
- Consistent color palette
- Typography system
- Component customization
- Responsive design

## Error Handling

Comprehensive error handling throughout the application:
- API error handling
- WebSocket error recovery
- Form validation
- User feedback

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

Run tests with:
```bash
npm test
```

## Building for Production

Build the application for production:
```bash
npm run build
```

The build output will be in the `build` directory.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 