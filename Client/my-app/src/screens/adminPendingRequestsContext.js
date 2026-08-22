import {
  createContext,
  useContext,
} from "react";


const defaultValue = {
  pendingCount: 0,
  setPendingCount: () => {},
  refreshPendingCount:
    async () => {},
};


export const AdminPendingRequestsContext =
  createContext(defaultValue);


export const useAdminPendingRequests = () =>
  useContext(
    AdminPendingRequestsContext
  );
