import axios from 'axios';

export class ApiError extends Error {
  status: number;
  identifier: string;
  message: string;

  constructor(status: number, identifier: string, message: string) {
    super(`API Error (${status}, ${identifier}): ${message}`);
    this.status = status;
    this.identifier = identifier;
    this.message = message;
  }
}

export const API_BASE_URL = 'https://api.broiler.dev/prod';

export async function loginToGithub(path: string): Promise<void> {
  var host = window.location.host;
  var protocol = window.location.protocol;

  const params = new URLSearchParams({
    redirect_uri: `${protocol}//${host}/${path}`,
    client_id: 'Ov23liTHLu0Wmad0PiKp',
    scope: 'read:user user:email',
    state: Math.random().toString(36).substring(2, 15)
  });

  window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export class User {
  id: string;
  name: string;
  display_name: string;
  email: string;
}

export async function getMe(): Promise<User> {
  try {
    const response = await axios.get<User>(`${API_BASE_URL}/user/me`, {
      withCredentials: true,
      fetchOptions: {
        credentials: 'include'
      }
    });

    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      const apiError = error.response.data;
      throw new ApiError(error.response.status, apiError.identifier, apiError.message);
    } else {
      throw new Error('An unknown error occurred while fetching user data.');
    }
  }
}

export async function nuke(): Promise<void> {
  try {
    await axios.post(`${API_BASE_URL}/user/nuke`, {}, {
      withCredentials: true,
      fetchOptions: {
        credentials: 'include'
      }
    });
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      const apiError = error.response.data;
      throw new ApiError(error.response.status, apiError.identifier, apiError.message);
    } else {
      throw new Error('An unknown error occurred while attempting to delete the user account.');
    }
  }
}

export async function authenticateGithub(code: string, state: string): Promise<User> {
  try {
    const response = await axios.post<User>(`${API_BASE_URL}/auth/github`, {
      code,
      state
    }, {
      withCredentials: true,
      fetchOptions: {
        credentials: 'include'
      }
    });

    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      const apiError = error.response.data;
      throw new ApiError(error.response.status, apiError.identifier, apiError.message);
    } else {
      throw new Error('An unknown error occurred during GitHub authentication.');
    }
  }
}