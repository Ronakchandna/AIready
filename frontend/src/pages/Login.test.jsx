import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const renderLogin = () => render(
    <MemoryRouter initialEntries={['/login']}>
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div>Dashboard page</div>} />
        </Routes>
    </MemoryRouter>
);

describe('Login page', () => {
    test('signs in with email and password and opens the dashboard', async () => {
        const login = jest.fn().mockResolvedValue(true);
        useAuth.mockReturnValue({ login, demoLogin: jest.fn() });
        renderLogin();

        fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.co' } });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in to workspace/i }));

        await waitFor(() => expect(screen.getByText('Dashboard page')).toBeInTheDocument());
        expect(login).toHaveBeenCalledWith('a@b.co', 'secret123');
    });

    test('shows the server error message when login fails', async () => {
        const login = jest.fn().mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });
        useAuth.mockReturnValue({ login, demoLogin: jest.fn() });
        renderLogin();

        fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.co' } });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in to workspace/i }));

        expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    });

    test('"Try the demo" signs in without a password', async () => {
        const demoLogin = jest.fn().mockResolvedValue(true);
        useAuth.mockReturnValue({ login: jest.fn(), demoLogin });
        renderLogin();

        fireEvent.click(screen.getByRole('button', { name: /try the demo/i }));

        await waitFor(() => expect(screen.getByText('Dashboard page')).toBeInTheDocument());
        expect(demoLogin).toHaveBeenCalledTimes(1);
    });
});
