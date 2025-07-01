import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders admin dashboard', () => {
  render(<App />);
  const dashboardElement = screen.getByText(/admin dashboard/i);
  expect(dashboardElement).toBeInTheDocument();
});
