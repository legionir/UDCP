import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000'
});

export const getDevices = () =>
  api.get('/api/devices').then(r => r.data);

---