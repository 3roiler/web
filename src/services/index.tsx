import axios from 'axios';
import { getApiBaseUrl } from '../config/api';
import { Routes } from '../config/routes';

const ClientId = 'Ov23liULYLUWCVnTGLLN';
const Scope = 'read:user user:email';

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

export class User {
  id: string;
  name: string;
  display_name: string;
  email: string;
}

export async function getMe(): Promise<User> {
  try {
    const response = await axios.get<User>(`${getApiBaseUrl()}/user/me`, {
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
    await axios.post(`${getApiBaseUrl()}/user/nuke`, {}, {
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

export async function loginToGithub(): Promise<void> {
  const host = globalThis.location.host;
  const protocol = globalThis.location.protocol;

  const params = new URLSearchParams({
    redirect_uri: `${protocol}//${host}/${Routes.Callback.Github}`,
    client_id: ClientId,
    scope: Scope,
    state: Math.random().toString(36).substring(2, 15)
  });

  globalThis.location.href = `${Routes.External.GithubOauth}?${params.toString()}`;
}

export async function authenticateGithub(code: string, state: string): Promise<User> {
  try {
    const response = await axios.post<User>(`${getApiBaseUrl()}/github/oauth`, {
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

export async function logout(): Promise<void> {
  try {
    await axios.post(`${getApiBaseUrl()}/logout`, {}, {
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
      throw new Error('An unknown error occurred during logout.');
    }
  }
}