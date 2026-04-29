// Contenido COMPLETO para: src/helpers/fakebackend_helper.ts

import { APIClient } from "./api_helper";
import * as url from "./url_helper";
import axios from 'axios';
import { env } from '../env';


const api = new APIClient();

// Gets the logged in user data from local session
export const getLoggedInUser = () => {
  const user = localStorage.getItem("user");
  if (user) return JSON.parse(user);
  return null;
};

// is user is logged in
export const isUserAuthenticated = () => {
  return getLoggedInUser() !== null;
};



// ================================================================
// --- NUESTRA LÓGICA DE LOGIN (CORREGIDA) ---
// ================================================================

export const postJwtLogin = async (data: any) => {
  try {
    const cleanAxios = axios.create({
      baseURL: env.API_URL,
      withCredentials: true,
    });
    const response = await cleanAxios.post("/auth/login", {
      email: data.email,
      password: data.password,
    });
    const responseData = response.data;
    if (responseData && responseData.token) {
      const authUser = {
        message: "Login Successful",
        token: responseData.token,
        user: { email: data.email },
      };
      sessionStorage.setItem("authUser", JSON.stringify(authUser));
      localStorage.setItem("authToken", responseData.token);
      return authUser;
    }
    throw new Error("La respuesta de la API no incluyó un token.");
  } catch (error: any) {
    console.error("Error en postJwtLogin:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};


// ================================================================
// --- ✅ NUESTRAS FUNCIONES PARA EL CALENDARIO ---
// ================================================================

// Obtener citas por tenant y rango de fechas
export const getAppointmentsByTenant = (tenantId: string, startDate: string, endDate: string) => 
    api.get(`${url.GET_APPOINTMENTS_BY_TENANT}/${tenantId}`, { params: { startDate, endDate } });

// Obtener usuarios (clientes o estilistas) por tenant y rol
export const getUsersByTenantAndRole = (tenantId: string, roleId: number) =>
    api.get(`${url.GET_USERS_BY_TENANT}/${tenantId}`, { params: { role_id: roleId } });

// Obtener servicios por tenant
export const getServicesByTenant = (tenantId: string) =>
    api.get(`${url.GET_SERVICES_BY_TENANT}/${tenantId}`, {});

// Obtener el próximo estilista disponible
export const getNextAvailableStylist = () =>
    api.get(url.GET_NEXT_AVAILABLE_STYLIST, {});

// Obtener horarios disponibles
export const getAvailability = (tenantId: string, stylistId: string, date: string) =>
    api.get(url.GET_AVAILABILITY, { params: { tenant_id: tenantId, stylist_id: stylistId, date } });

// Crear un nuevo usuario (usado para nuevos clientes)
export const createNewUser = (userData: any) => 
    api.create("/users", userData);

// Crear una nueva cita
export const createAppointment = (appointmentData: any) =>
    api.create(url.CREATE_APPOINTMENT, appointmentData);

// Actualizar una cita existente
export const updateAppointment = (appointment: any) =>
    api.put(`${url.UPDATE_APPOINTMENT}/${appointment.id}`, appointment);

// Crear múltiples citas en un batch
export const createAppointmentsBatch = (appointmentsData: any) =>
    api.create(url.CREATE_APPOINTMENTS_BATCH, appointmentsData);

// ================================================================
// --- CÓDIGO DE LA DEMO (Lo mantenemos para evitar errores) ---
// ================================================================

// Register Method
export const postFakeRegister = (data : any) => api.create(url.POST_FAKE_REGISTER, data);

// Login Method (Fake)
export const postFakeLogin = (data : any) => api.create(url.POST_FAKE_LOGIN, data);

// postForgetPwd
export const postFakeForgetPwd = (data : any) => api.create(url.POST_FAKE_PASSWORD_FORGET, data);

// Edit profile
export const postJwtProfile = (data : any) => api.create(url.POST_EDIT_JWT_PROFILE, data);
export const postFakeProfile = (data : any) => api.update(url.POST_EDIT_PROFILE + '/' + data.idx, data);
// Register a new Tenant and its Admin user
export const postRegisterTenantAdmin = (data: any) => {
  return api.create("/auth/register-tenant", data);
};
// Register Method
export const postJwtRegister = (data: any) => {
  // La URL del endpoint de creación de usuarios es '/users'
  return api.create("/users", data);
};

export const getAppointments = (tenantId: string, startDate: string, endDate: string) => {
  const urlWithParams = `${url.GET_APPOINTMENTS_BY_TENANT}/${tenantId}?startDate=${startDate}&endDate=${endDate}`;
  // CORRECCIÓN: Añadimos un segundo argumento vacío
  return api.get(urlWithParams, {}); 
};

// postForgetPwd
export const postJwtForgetPwd = (data : any) => api.create(url.POST_FAKE_JWT_PASSWORD_FORGET, data);

// postSocialLogin
export const postSocialLogin = (data : any) => api.create(url.SOCIAL_LOGIN, data);

// Calendar
export const getEvents = () => api.get(url.GET_EVENTS, '');
export const getCategories = () => api.get(url.GET_CATEGORIES, '');
export const getUpCommingEvent = () => api.get(url.GET_UPCOMMINGEVENT, '');
export const addNewEvent = (event : any) => api.create(url.ADD_NEW_EVENT, event);
export const updateEvent = (event : any) => api.put(url.UPDATE_EVENT, event);
export const deleteEvent = (event : any) => api.delete(url.DELETE_EVENT, { headers: { event } });

// Chat
export const getDirectContact = () => api.get(url.GET_DIRECT_CONTACT, '');
export const getMessages = (roomId : any) => api.get(`${url.GET_MESSAGES}/${roomId}`, { params: { roomId } });
export const addMessage = (message : any) => api.create(url.ADD_MESSAGE, message);
export const deleteMessage = (message : any) => api.delete(url.DELETE_MESSAGE, { headers: { message } });

// MailBox
export const getMailDetails = () => api.get(url.GET_MAIL_DETAILS, '');
export const deleteMail = (forId  :any) => api.delete(url.DELETE_MAIL, { headers: { forId } });
export const unreadMail = (forId: any) => api.delete(url.UNREAD_MAIL, { headers: { forId } });
export const staredMail = (forId: any) => api.delete(url.STARED_MAIL, { headers: { forId } });
export const labelMail = (forId: any) => api.delete(url.LABEL_MAIL, { headers: { forId } });
export const trashMail = (forId: any) => api.delete(url.TRASH_MAIL, { headers: { forId } });

// Ecommerce
export const getProducts = () => api.get(url.GET_PRODUCTS, '');
export const deleteProducts = (product : any) => api.delete(url.DELETE_PRODUCT, { headers: { product } } );
export const addNewProduct = (product : any) => api.create(url.ADD_NEW_PRODUCT, product);
export const updateProduct = (product : any) => api.update(url.UPDATE_PRODUCT, product );
export const getOrders = () => api.get(url.GET_ORDERS, '');
export const addNewOrder = (order : any) => api.create(url.ADD_NEW_ORDER, order);
export const updateOrder = (order : any) => api.update(url.UPDATE_ORDER, order);
export const deleteOrder = (order : any) => api.delete(url.DELETE_ORDER , { headers: { order } });
export const getCustomers = () => api.get(url.GET_CUSTOMERS, '');
export const addNewCustomer = (customer : any) => api.create(url.ADD_NEW_CUSTOMER, customer);
export const updateCustomer = (customer : any) => api.update(url.UPDATE_CUSTOMER, customer);
export const deleteCustomer = (customer : any) => api.delete(url.DELETE_CUSTOMER, { headers: { customer } });
export const getSellers = () => api.get(url.GET_SELLERS, '');

// Project
export const getProjectList = () => api.get(url.GET_PROJECT_LIST, '');
export const addProjectList = (project : any) => api.create(url.ADD_NEW_PROJECT, project);
export const updateProjectList = (project : any) => api.put(url.UPDATE_PROJECT, project);
export const deleteProjectList = (project : any) => api.delete(url.DELETE_PROJECT, { headers: { project } });


// Tasks
export const getTaskList = () => api.get(url.GET_TASK_LIST, '');
export const addNewTask = (task : any) => api.create(url.ADD_NEW_TASK, task);
export const updateTask = (task : any) => api.update(url.UPDATE_TASK, task);
export const deleteTask = (task : any) => api.delete(url.DELETE_TASK, { headers: { task }});

// Kanban Board
export const getTasks = () => api.get(url.GET_TASKS, "");
export const addNewTasks = (card: any) => api.create(url.ADD_TASKS, card)
export const updateTasks = (card: any) => api.put(url.UPDATE_TASKS, card)
export const deleteTasks = (card: any) => api.delete(url.DELETE_TASKS, { headers: {card} })

// CRM
export const getContacts = () => api.get(url.GET_CONTACTS, '');
export const addNewContact = (contact : any) => api.create(url.ADD_NEW_CONTACT, contact);
export const updateContact = (contact : any) => api.update(url.UPDATE_CONTACT, contact);
export const deleteContact = (contact : any) => api.delete(url.DELETE_CONTACT, { headers: { contact }});
export const getCompanies = () => api.get(url.GET_COMPANIES, '');
export const addNewCompanies = (company : any) => api.create(url.ADD_NEW_COMPANIES, company);
export const updateCompanies = (company : any) => api.update(url.UPDATE_COMPANIES, company);
export const deleteCompanies = (company : any) => api.delete(url.DELETE_COMPANIES, { headers: {company}});
export const getDeals = () => api.get(url.GET_DEALS, '');
export const getLeads = () => api.get(url.GET_LEADS, '');
export const addNewLead = (lead : any) => api.create(url.ADD_NEW_LEAD, lead);
export const updateLead = (lead : any) => api.update(url.UPDATE_LEAD, lead);
export const deleteLead = (lead : any) => api.delete(url.DELETE_LEAD, { headers: {lead}});

// Crypto
export const getTransationList = () => api.get(url.GET_TRANSACTION_LIST, '');
export const getOrderList = () => api.get(url.GET_ORDRER_LIST, '');

// Invoice
export const getInvoices = () => api.get(url.GET_INVOICES, '');
export const addNewInvoice = (invoice : any) => api.create(url.ADD_NEW_INVOICE, invoice);
export const updateInvoice = (invoice : any) => api.update(url.UPDATE_INVOICE + '/' + invoice._id, invoice);
export const deleteInvoice = (invoice : any) => api.delete(url.DELETE_INVOICE + '/' + invoice);

// Support Tickets 
export const getTicketsList = () => api.get(url.GET_TICKETS_LIST, '');
export const addNewTicket = (ticket : any) => api.create(url.ADD_NEW_TICKET, ticket);
export const updateTicket = (ticket : any) => api.update(url.UPDATE_TICKET, ticket);
export const deleteTicket = (ticket : any) => api.delete(url.DELETE_TICKET, { headers: {ticket}});

// Dashboard Analytics
export const getAllData = () => api.get(url.GET_ALL_DATA, '');
export const getHalfYearlyData = () => api.get(url.GET_HALFYEARLY_DATA, '');
export const getMonthlyData = () => api.get(url.GET_MONTHLY_DATA, '');
export const getAllAudiencesMetricsData = () => api.get(url.GET_ALLAUDIENCESMETRICS_DATA, '');
export const getMonthlyAudiencesMetricsData = () => api.get(url.GET_MONTHLYAUDIENCESMETRICS_DATA, '');
export const getHalfYearlyAudiencesMetricsData = () => api.get(url.GET_HALFYEARLYAUDIENCESMETRICS_DATA, '');
export const getYearlyAudiencesMetricsData = () => api.get(url.GET_YEARLYAUDIENCESMETRICS_DATA, '');
export const getTodayDeviceData = () => api.get(url.GET_TODAYDEVICE_DATA, '');
export const getLastWeekDeviceData = () => api.get(url.GET_LASTWEEKDEVICE_DATA, '');
export const getLastMonthDeviceData = () => api.get(url.GET_LASTMONTHDEVICE_DATA, '');
export const getCurrentYearDeviceData = () => api.get(url.GET_CURRENTYEARDEVICE_DATA, '');
export const getTodaySessionData = () => api.get(url.GET_TODAYSESSION_DATA, '');
export const getLastWeekSessionData = () => api.get(url.GET_LASTWEEKSESSION_DATA, '');
export const getLastMonthSessionData = () => api.get(url.GET_LASTMONTHSESSION_DATA, '');
export const getCurrentYearSessionData = () => api.get(url.GET_CURRENTYEARSESSION_DATA, '');

// Dashboard CRM
export const getTodayBalanceData = () => api.get(url.GET_TODAYBALANCE_DATA, '');
export const getLastWeekBalanceData = () => api.get(url.GET_LASTWEEKBALANCE_DATA, '');
export const getLastMonthBalanceData = () => api.get(url.GET_LASTMONTHBALANCE_DATA, '');
export const getCurrentYearBalanceData = () => api.get(url.GET_CURRENTYEARBALANCE_DATA, '');
export const getTodayDealData = () => api.get(url.GET_TODAYDEAL_DATA, '');
export const getWeeklyDealData = () => api.get(url.GET_WEEKLYDEAL_DATA, '');
export const getMonthlyDealData = () => api.get(url.GET_MONTHLYDEAL_DATA, '');
export const getYearlyDealData = () => api.get(url.GET_YEARLYDEAL_DATA, '');
export const getOctSalesData = () => api.get(url.GET_OCTSALES_DATA, '');
export const getNovSalesData = () => api.get(url.GET_NOVSALES_DATA, '');
export const getDecSalesData = () => api.get(url.GET_DECSALES_DATA, '');
export const getJanSalesData = () => api.get(url.GET_JANSALES_DATA, '');

// Dashboard Ecommerce
export const getAllRevenueData = () => api.get(url.GET_ALLREVENUE_DATA, '');
export const getMonthRevenueData = () => api.get(url.GET_MONTHREVENUE_DATA, '');
export const getHalfYearRevenueData = () => api.get(url.GET_HALFYEARREVENUE_DATA, '');
export const getYearRevenueData = () => api.get(url.GET_YEARREVENUE_DATA, '');

// Dashboard Crypto
export const getBtcPortfolioData = () => api.get(url.GET_BTCPORTFOLIO_DATA, '');
export const getUsdPortfolioData = () => api.get(url.GET_USDPORTFOLIO_DATA, '');
export const getEuroPortfolioData = () => api.get(url.GET_EUROPORTFOLIO_DATA, '');

// Market Graph
export const getAllMarketData = () => api.get(url.GET_ALLMARKETDATA_DATA, '');
export const getYearMarketData = () => api.get(url.GET_YEARMARKET_DATA, '');
export const getMonthMarketData = () => api.get(url.GET_MONTHMARKET_DATA, '');
export const getWeekMarketData = () => api.get(url.GET_WEEKMARKET_DATA, '');
export const getHourMarketData = () => api.get(url.GET_HOURMARKET_DATA, '');

// Dashboard Project
export const getAllProjectData = () => api.get(url.GET_ALLPROJECT_DATA, '');
export const getMonthProjectData = () => api.get(url.GET_MONTHPROJECT_DATA, '');
export const gethalfYearProjectData = () => api.get(url.GET_HALFYEARPROJECT_DATA, '');
export const getYearProjectData = () => api.get(url.GET_YEARPROJECT_DATA, '');
export const getAllProjectStatusData = () => api.get(url.GET_ALLPROJECTSTATUS_DATA, '');
export const getWeekProjectStatusData = () => api.get(url.GET_WEEKPROJECTSTATUS_DATA, '');
export const getMonthProjectStatusData = () => api.get(url.GET_MONTHPROJECTSTATUS_DATA, '');
export const getQuarterProjectStatusData = () => api.get(url.GET_QUARTERPROJECTSTATUS_DATA, '');

// Dashboard NFT
export const getAllMarketplaceData = () => api.get(url.GET_ALLMARKETPLACE_DATA, '');
export const getMonthMarketplaceData = () => api.get(url.GET_MONTHMARKETPLACE_DATA, '');
export const gethalfYearMarketplaceData = () => api.get(url.GET_HALFYEARMARKETPLACE_DATA, '');
export const getYearMarketplaceData = () => api.get(url.GET_YEARMARKETPLACE_DATA, '');

// Pages > Team
export const getTeamData = () => api.get(url.GET_TEAMDATA, '');
export const deleteTeamData = (team : any) => api.delete(url.DELETE_TEAMDATA, { headers: { team } });
export const addTeamData = (team : any) => api.create(url.ADD_NEW_TEAMDATA, team);
export const updateTeamData = (team : any) => api.put(url.UPDATE_TEAMDATA, team);

// File Manager
export const getFolders = () => api.get(url.GET_FOLDERS, '');
export const deleteFolder = (folder : any) => api.delete(url.DELETE_FOLDER, { headers: { folder } });
export const addNewFolder = (folder : any) => api.create(url.ADD_NEW_FOLDER, folder);
export const updateFolder = (folder : any) => api.put(url.UPDATE_FOLDER, folder);
export const getFiles = () => api.get(url.GET_FILES, '');
export const deleteFile = (file : any) => api.delete(url.DELETE_FILE, { headers: { file } });
export const addNewFile = (file : any) => api.create(url.ADD_NEW_FILE, file);
export const updateFile = (file : any) => api.put(url.UPDATE_FILE, file);

// To Do
export const getTodos = () => api.get(url.GET_TODOS, '');
export const deleteTodo = (todo : any) => api.delete(url.DELETE_TODO, { headers: { todo } });
export const addNewTodo = (todo : any) => api.create(url.ADD_NEW_TODO, todo);
export const updateTodo = (todo : any) => api.put(url.UPDATE_TODO, todo);
export const getProjects = () => api.get(url.GET_PROJECTS, '');
export const addNewProject = (project : any) => api.create(url.ADD_NEW_TODO_PROJECT, project);

//API Key
export const getAPIKey = () => api.get(url.GET_API_KEY, '');

//Job Application
export const getJobApplicationList = () => api.get(url.GET_APPLICATION_LIST, '');
export const addNewJobApplicationList = (job: any) => api.create(url.ADD_NEW_APPLICATION_LIST, job);
export const updateJobApplicationList = (job: any) => api.put(url.UPDATE_APPLICATION_LIST, job);
export const deleteJobApplicationList = (job: any) => api.delete(url.DELETE_APPLICATION_LIST, { headers: { job } });

// candidate list
export const getJobCandidateList = () => api.get(url.GET_CANDIDATE, '');
export const addJobCandidate = (candidate : any) => api.create(url.ADD_NEW_CANDIDATE, candidate);
export const updateJobCandidate = (candidate : any) => api.update(url.UPDATE_CANDIDATE, candidate);
export const deleteJobCandidate = (candidate : any) => api.delete(url.DELETE_CANDIDATE, { headers: {candidate} });

// category list
export const getcategoryList = () => api.get(url.GET_CATEGORY_LIST, '');
export const addcategoryList = (category : any) => api.create(url.ADD_CATEGORY_LIST, category);

// grid
export const getCandidateGrid = () => api.get(url.GET_CANDIDATE_GRID, '');
export const addCandidateGrid = (category : any) => api.create(url.ADD_CANDIDATE_GRID, category);