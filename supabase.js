const SUPABASE_URL = "https://kjwdhusevgrbspwqsvsm.supabase.co";
const SUPABASE_KEY = "sb_publishable_dcejME7Sld3Sy9P8c7wa9Q_tvJ7tEnA";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);