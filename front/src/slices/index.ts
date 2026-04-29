// Contenido COMPLETO y CORREGIDO para tu rootReducer

import { combineReducers } from "redux";

// --- PASO 1: Importa tu nuevo reducer ---
import settingsReducer from "./Settings/settingsSlice"; // Usando la ruta que creaste
import crumiChatReducer from "./crumiChat/chatSlice";
import authModalReducer from "./authModal/authModalSlice";

// Front
import LayoutReducer from "./layouts/reducer";

// Authentication
import LoginReducer from "./auth/login/reducer";
import AccountReducer from "./auth/register/reducer";
import ForgetPasswordReducer from "./auth/forgetpwd/reducer";
import ProfileReducer from "./auth/profile/reducer";
import tenantRegisterReducer from "./auth/tenantRegister/reducer";

// ... (todas tus otras importaciones se quedan igual)
import CalendarReducer from "./calendar/reducer";
import chatReducer from "./chat/reducer";
import EcommerceReducer from "./ecommerce/reducer";
import ProductsReducer from './products/slice';
import ProjectsReducer from "./projects/reducer";
import TasksReducer from "./tasks/reducer";
import CryptoReducer from "./crypto/reducer";
import TicketsReducer from "./tickets/reducer";
import CrmReducer from "./crm/reducer";
import InvoiceReducer from "./invoice/reducer";
import MailboxReducer from "./mailbox/reducer";
import DashboardAnalyticsReducer from "./dashboardAnalytics/reducer";
import DashboardCRMReducer from "./dashboardCRM/reducer";
import DashboardEcommerceReducer from "./dashboardEcommerce/reducer";
import DashboardCryptoReducer from "./dashboardCrypto/reducer";
import DashboardProjectReducer from "./dashboardProject/reducer";
import DashboardNFTReducer from "./dashboardNFT/reducer";
import TeamDataReducer from "./team/reducer";
import FileManagerReducer from "./fileManager/reducer";
import TodosReducer from "./todos/reducer";
import JobReducer from "./jobs/reducer";
import APIKeyReducer from "./apiKey/reducer";
import whatsappReducer from "./whatsapp/whatsappSlice";

const rootReducer = combineReducers({
    // --- PASO 2: Añade tu reducer a la lista ---
    settings: settingsReducer,
    crumiChat: crumiChatReducer,
    authModal: authModalReducer,
    whatsapp: whatsappReducer,

    // El resto de tus reducers
    Layout: LayoutReducer,
    Login: LoginReducer,
    Account: AccountReducer,
    ForgetPassword: ForgetPasswordReducer,
    Profile: ProfileReducer,
    tenantRegister: tenantRegisterReducer,
    Calendar: CalendarReducer,
    Chat: chatReducer,
    Projects: ProjectsReducer,
    Ecommerce: EcommerceReducer,
    products: ProductsReducer,
    Tasks: TasksReducer,
    Crypto: CryptoReducer,
    Tickets: TicketsReducer,
    Crm: CrmReducer,
    Invoice: InvoiceReducer,
    Mailbox: MailboxReducer,
    DashboardAnalytics: DashboardAnalyticsReducer,
    DashboardCRM: DashboardCRMReducer,
    DashboardEcommerce: DashboardEcommerceReducer,
    DashboardCrypto: DashboardCryptoReducer,
    DashboardProject: DashboardProjectReducer,
    DashboardNFT: DashboardNFTReducer,
    Team: TeamDataReducer,
    FileManager: FileManagerReducer,
    Todos: TodosReducer,
    Jobs: JobReducer,
    APIKey: APIKeyReducer
});

export default rootReducer;