/**
 * Every backend call the portals make, in one place.
 *
 * Components import these instead of hand-writing URLs, which is how the
 * front end and back end drifted apart (`POST /api/bills` vs `POST /api/bill`,
 * and a `PUT /api/custom-items/:name` with no route behind it).
 */

import client from './client';

// ------------------------------------------------------------------ auth

export const fetchLoginAccounts = () =>
  client.get('/api/auth/accounts', { skipAuthRedirect: true }).then((r) => r.data.accounts || []);

export const login = (email, password) =>
  client.post('/api/auth/login', { email, password }, { skipAuthRedirect: true }).then((r) => r.data);

export const logout = () => client.post('/api/auth/logout').then((r) => r.data);

// -------------------------------------------------------------- settings

/** The restaurant settings (name, phones, payment methods, …) - public. */
export const fetchSettings = () =>
  client.get('/api/settings', { skipAuthRedirect: true }).then((r) => r.data.settings);

// ------------------------------------------------------------ management

/** Management -> Restaurant: save name, tagline, owner, address, phones, GSTIN. */
export const updateSettings = (fields) =>
  client.put('/api/settings', fields).then((r) => r.data.settings);

/** Management -> Users (admin). */
export const fetchUsers = () => client.get('/api/users').then((r) => r.data.users || []);

export const createUser = (user) => client.post('/api/users', user).then((r) => r.data);

export const deleteUser = (id) =>
  client.delete(`/api/users/${encodeURIComponent(id)}`).then((r) => r.data);

export const resetUserPassword = (id, password) =>
  client.put(`/api/users/${encodeURIComponent(id)}/password`, { password }).then((r) => r.data);

/** Management -> My account: change the signed-in user's own password. */
export const changeMyPassword = (currentPassword, newPassword) =>
  client.post('/api/auth/password', { currentPassword, newPassword }).then((r) => r.data);

// ------------------------------------------------------------------ menu

export const fetchMenuItems = () => client.get('/api/custom-items').then((r) => r.data.items || []);

export const fetchCategories = () => client.get('/api/categories').then((r) => r.data.categories || []);

export const createMenuItem = (formData) =>
  client.post('/api/custom-items', formData).then((r) => r.data);

export const updateMenuItem = (name, payload) =>
  client.put(`/api/custom-items/${encodeURIComponent(name)}`, payload).then((r) => r.data);

export const deleteMenuItem = (name) =>
  client.delete(`/api/custom-items/${encodeURIComponent(name)}`).then((r) => r.data);

export const createCategory = (name) => client.post('/api/categories', { name }).then((r) => r.data);

export const deleteCategory = (name) =>
  client.delete(`/api/categories/${encodeURIComponent(name)}`).then((r) => r.data);

// ------------------------------------------------------------------ bills

export const fetchNextBillNumber = () =>
  client.get('/api/bill-number').then((r) => r.data.billNumber);

export const saveBill = (bill) => client.post('/api/bill', bill).then((r) => r.data);

export const fetchBills = () => client.get('/api/bills').then((r) => r.data.bills || []);

// Bills are addressed by their unique document id. Bill *numbers* restart at
// 1 each morning, so hundreds of bills share one - addressing by number could
// delete an unrelated day's bill.

export const deleteBillPermanently = (id) =>
  client.delete(`/api/bill/${id}/permanent-delete`).then((r) => r.data);

// ---------------------------------------------------------------- reports

/**
 * The sales workbook for a date range, as a Blob ready to save.
 *
 * Built by the server from every bill in the range, not from the page's
 * already-loaded list, so a long range cannot be silently truncated.
 */
export const downloadSalesWorkbook = async (from, to) => {
  let response;
  try {
    response = await client.get('/api/reports/sales.xlsx', {
      params: { from, to },
      responseType: 'blob',
    });
  } catch (err) {
    // With responseType 'blob' the JSON error body arrives as a Blob too;
    // unwrap it so the UI can show "No bills in that date range" rather than
    // a bare status code.
    const body = err.response?.data;
    if (body instanceof Blob) {
      try {
        err.response.data = JSON.parse(await body.text());
      } catch {
        /* not JSON - leave it */
      }
    }
    throw err;
  }

  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob: response.data,
    filename: match ? match[1] : `Sales_${from}_to_${to}.xlsx`,
  };
};
