import axiosInstance from '../axiosInstance'

export const taskService = {
    list: async () => (await axiosInstance.get('/tasks/fetch')).data.tasks,
    update: async (id, changes) => (await axiosInstance.put(`/tasks/update/${id}`, changes)).data.task,
    remove: async (id) => axiosInstance.delete(`/tasks/delete/${id}`),
}
