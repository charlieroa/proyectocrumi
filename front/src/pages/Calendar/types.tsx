export interface AppointmentFormValues {
  client_id: string;
  service_id: string;
  stylist_id: string;
  date: string | Date;
  start_time: string;
  newClientFirstName: string;
  newClientLastName: string;
  newClientPhone: string;
  newClientEmail: string;
  newClientPassword: string;
}