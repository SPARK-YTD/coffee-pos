const supabaseUrl = "https://olbimevfyvnvzbemkjcl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sYmltZXZmeXZudnpiZW1ramNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTQ4MDUsImV4cCI6MjA5MTQ5MDgwNX0.c9ilX5NbI6T7DW99G-6ifp1dbBK3T0YVEHlNb-QEci0";

window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
