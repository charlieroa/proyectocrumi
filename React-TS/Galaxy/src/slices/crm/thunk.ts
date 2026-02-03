import { createAsyncThunk } from "@reduxjs/toolkit";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

//Include Both Helper File with needed methods
import {
  getContacts as getContactsApi,
  addNewContact as addNewContactApi,
  updateContact as updateContactApi,
  deleteContact as deleteContactApi,
  getCompanies as getCompaniesApi,
  addNewCompanies as addNewCompaniesApi,
  updateCompanies as updateCompaniesApi,
  deleteCompanies as deleteCompaniesApi,
  getDeals as getDealsApi,
  getLeads as getLeadsApi,
  addNewLead as addNewLeadApi,
  updateLead as updateLeadApi,
  deleteLead as deleteLeadApi
} from "../../helpers/fakebackend_helper";

// Contact

export const getContacts = createAsyncThunk("crm/getContacts" , async () => {
  try{
    const response = getContactsApi()
    return response;
  }catch (error) {
    return error;
  }
})

export const addNewContact = createAsyncThunk("crm/addNewContact" , async (contact : any) => {
  try{
    const response = addNewContactApi(contact)
    toast.success("Contact Added Successfully", { autoClose: 3000 });
    return response;
  }catch (error) {
    toast.error("Contact Added Failed", { autoClose: 3000 });
    return error;
  }
})

export const updateContact = createAsyncThunk("crm/updateContact" , async (contact : any) => {
  try{
    const response = updateContactApi(contact)
    toast.success("Contact Updated Successfully", { autoClose: 3000 });
    return response;
  }catch (error) {
    toast.error("Contact Updated Failed", { autoClose: 3000 });
    return error;
  }
})

export const deleteContact = createAsyncThunk("crm/deleteContact" , async (contact : any) => {
  try{
    const response = deleteContactApi(contact)
    toast.success("Contact Deleted Successfully", { autoClose: 3000 });
    return { contact, ...response };
  }catch (error) {
    toast.error("Contact Deleted Failed", { autoClose: 3000 });
    return error;
  }
})

// Company

export const getCompanies = createAsyncThunk("crm/getCompanies" , async () => {
  try{
      const response = getCompaniesApi()
      return response;
  }catch (error) {
    return error;
  }
})

export const addNewCompanies = createAsyncThunk("crm/addNewCompanies" , async (company : any) => {
  try{
    const response = addNewCompaniesApi(company)
    toast.success("Company Added Successfully", { autoClose: 3000 });
    return response;
  }catch (error) {
    toast.error("Company Added Failed", { autoClose: 3000 });
    return error;
  }
})

export const updateCompanies = createAsyncThunk("crm/updateCompanies" , async (company : any) => {
  try{
    const response = updateCompaniesApi(company)
    toast.success("Company Updated Successfully", { autoClose: 3000 });
    return response;
  }catch (error) {
    toast.error("Company Updated Failed", { autoClose: 3000 });
    return error;
  }
})

export const deleteCompanies = createAsyncThunk("crm/deleteCompanies" , async (company : any) => {
  try{
    const response = deleteCompaniesApi(company)
    toast.success("Company Deleted Successfully", { autoClose: 3000 });
    return { company, ...response };
  }catch (error) {
    toast.error("Company Deleted Failed", { autoClose: 3000 });
    return error;
  }
})

export const getLeads = createAsyncThunk("crm/getLeads" , async () => {
  try{
    const response = getLeadsApi()
    return response;
  }catch (error) {
    return error;
  }
})

export const addNewLead = createAsyncThunk("crm/addNewLead" , async (lead : any) => {
  try{
    const response = addNewLeadApi(lead)
    toast.success("Lead Added Successfully", { autoClose: 3000 });
    return response;
  }catch (error) {
    toast.error("Lead Added Failed", { autoClose: 3000 });
    return error;
  }
})

export const updateLead = createAsyncThunk("crm/updateLead" , async (lead : any) => {
  try{
    const response = updateLeadApi(lead)
    toast.success("Lead Updated Successfully", { autoClose: 3000 });
    return response;
  }catch (error) {
    toast.error("Lead Updated Failed", { autoClose: 3000 });
    return error;
  }
})

export const deleteLead = createAsyncThunk("crm/deleteLead" , async (leads : any) => {
  try{
    const response = deleteLeadApi(leads)
    toast.success("Lead Deleted Successfully", { autoClose: 3000 });
    return { leads, ...response };

  }catch (error) {
    toast.error("Lead Deleted Failed", { autoClose: 3000 });
    return error;
  }
})

export const getDeals = createAsyncThunk("crm/getDeals" , async () => {
  try{
    const response = getDealsApi()
    return response;
  }catch (error) {
    return error;
  }
})