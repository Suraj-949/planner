import axios from 'axios';

const baseURL = import.meta.env.VITE_BASE_BACKEND_URL || 'http://localhost:3000/api';

const axiosInstance = axios.create({
    baseURL: baseURL,
    // Include credentials (cookies) in requests to support refresh token flow
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



// Add a response interceptor to handle 401 errors and attempt token refresh
axiosInstance.interceptors.response.use(
    function onFulfilled(response) {
        return response;
    },

    async function onRejected(error) {
        const originalRequest = error.config;

        // Check if the error is a 401 and we haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest.retry) {
            // Mark the request as having been retried
            originalRequest.retry = true; 
            try {
                // no need to send the refresh token in the body since it's stored in an HTTP-only cookie
                const response = await axiosInstance.post('/auth/refresh-token');
                console.log('Token refresh response:', response.data);
                localStorage.setItem('accessToken', response.data.accessToken);
                
                // Update the original request's Authorization header and retry it
                originalRequest.headers['Authorization'] = `Bearer ${response.data.accessToken}`;
                return axiosInstance(originalRequest);
            } catch (err) {
                console.error('Token refresh failed:', err);
            }
        }

        return Promise.reject(error);
    }
)

export default axiosInstance;
