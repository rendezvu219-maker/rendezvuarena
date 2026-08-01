import { api, setToken } from './api.js';
import { t } from './i18n.js';
const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const returnTo = params.get('return') || '/';
function message(text, error=false) { const el=$('#auth-message'); el.textContent=text; el.classList.remove('hidden'); el.classList.toggle('error',error); }
function clearMessage(){ $('#auth-message').classList.add('hidden'); }
function setMode(mode) {
  const register=mode==='register';
  $('#account-login').classList.toggle('hidden',register);
  $('#account-register').classList.toggle('hidden',!register);
  $('#show-login').classList.toggle('active',!register);
  $('#show-register').classList.toggle('active',register);
  clearMessage();
}
function completeAuthentication(payload){
  setToken('cookie-session');
  location.href=returnTo;
}
$('#show-login').addEventListener('click',()=>setMode('login'));
$('#show-register').addEventListener('click',()=>setMode('register'));
$('#account-login').addEventListener('submit',async event=>{event.preventDefault();try{const payload=await api('/api/auth/login',{method:'POST',body:{identity:$('#account-login-identity').value,password:$('#account-login-password').value}});completeAuthentication(payload);}catch(error){message(error.message,true);}});
$('#account-register').addEventListener('submit',async event=>{event.preventDefault();const password=$('#account-register-password').value;const passwordConfirmation=$('#account-register-password-confirm').value;if(password!==passwordConfirmation)return message(t('registrationPasswordMismatch'),true);try{const payload=await api('/api/auth/register',{method:'POST',body:{username:$('#account-register-username').value,password,passwordConfirmation}});completeAuthentication(payload);}catch(error){message(error.message,true);}});
setMode(params.get('mode')==='register'?'register':'login');
