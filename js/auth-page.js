import { api, setToken } from './api.js';
import { t } from './i18n.js';
const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const returnTo = params.get('return') || '/';
let verificationUser = null;
function message(text, error=false) { const el=$('#auth-message'); el.textContent=text; el.classList.remove('hidden'); el.classList.toggle('error',error); }
function clearMessage(){ $('#auth-message').classList.add('hidden'); }
function setMode(mode) {
  const register=mode==='register';
  const verify=mode==='verify';
  $('#account-login').classList.toggle('hidden',register||verify);
  $('#account-register').classList.toggle('hidden',!register);
  $('#account-verify').classList.toggle('hidden',!verify);
  $('#show-login').classList.toggle('active',!register&&!verify);
  $('#show-register').classList.toggle('active',register);
  $('.auth-tabs').classList.toggle('hidden',verify);
  clearMessage();
}
function showVerification(user){
  verificationUser=user;
  $('#account-verify-email').textContent=user?.email||'';
  $('#account-verify-code').value='';
  setMode('verify');
}
function completeAuthentication(payload){
  setToken('cookie-session');
  if(!payload.user?.emailVerified){showVerification(payload.user);return;}
  location.href=returnTo;
}
$('#show-login').addEventListener('click',()=>setMode('login'));
$('#show-register').addEventListener('click',()=>setMode('register'));
$('#account-login').addEventListener('submit',async event=>{event.preventDefault();try{const payload=await api('/api/auth/login',{method:'POST',body:{identity:$('#account-login-identity').value,password:$('#account-login-password').value}});completeAuthentication(payload);}catch(error){message(error.message,true);}});
$('#account-register').addEventListener('submit',async event=>{event.preventDefault();try{const payload=await api('/api/auth/register',{method:'POST',body:{displayName:$('#account-register-display').value,username:$('#account-register-username').value,email:$('#account-register-email').value,password:$('#account-register-password').value}});completeAuthentication(payload);}catch(error){message(error.message,true);}});
$('#account-verify').addEventListener('submit',async event=>{event.preventDefault();try{const payload=await api('/api/auth/verify-email',{method:'POST',body:{code:$('#account-verify-code').value}});verificationUser=payload.user;message(t('emailVerifiedRedirecting'));setTimeout(()=>location.href=returnTo,500);}catch(error){message(error.message,true);}});
$('#account-resend-code').addEventListener('click',async()=>{try{const payload=await api('/api/auth/resend-verification',{method:'POST'});message(payload.alreadyVerified?t('emailAlreadyVerified'):t('newVerificationCodeSent'));if(payload.alreadyVerified)setTimeout(()=>location.href=returnTo,500);}catch(error){message(error.message,true);}});
setMode(params.get('mode')==='register'?'register':'login');
