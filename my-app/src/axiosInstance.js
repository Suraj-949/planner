import axios from 'axios';

const baseURL = import.meta.env.VITE_BASE_BACKEND_URL || 'http://localhost:3000/api';

const axiosInstance = axios.create({
    baseURL: baseURL,
    // Include cookies so the refresh-token flow can work across frontend/backend ports.
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});


// Add a request interceptor to include the access token in the Authorization header for all requests
axiosInstance.interceptors.request.use(
    
    function(config) {
        const accessToken = localStorage.getItem('accessToken');

        if (accessToken) {
            config.headers = config.headers || {};
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        console.log('Request config:', config);
        return config;
    },
    function(error) {
        console.log('Error config : ', error.config)
        return Promise.reject(error);   
    }
)

export default axiosInstance;
