import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validar método POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 1. Validar Autenticación (Bearer Token o X-API-Key)
  const authHeader = req.headers.get('Authorization') || req.headers.get('X-API-Key');
  if (!authHeader) {
    console.warn('Alerta: Intento de acceso sin credenciales.');
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Missing credentials' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  // Instanciar cliente de Supabase usando el Service Role
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Comprobar contra variable de entorno primero (prioritaria)
  const secretEnv = Deno.env.get('ZAPIER_SECRET');
  let isAuthorized = false;

  if (secretEnv && token === secretEnv) {
    isAuthorized = true;
  } else {
    // Si no coincide o no existe la variable de entorno, buscar y validar en crm_settings via RPC
    const { data: isValid, error: authError } = await supabase.rpc('validate_zapier_secret', {
      p_secret: token
    });
    if (!authError && isValid === true) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    console.warn('Alerta: Credenciales de autenticación inválidas.');
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid credentials' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    console.log('Payload recibido de Zapier/SalesQL:', JSON.stringify(body));

    // 2. Validaciones básicas del payload
    if (!body.company && !body.company_name && !body.Company_Name && 
        !body.first_name && !body.First_Name && 
        !body.email && !body.email_1 && 
        !body.phone && !body.phone_1) {
      return new Response(
        JSON.stringify({ error: 'Payload vacío o inválido. Se requiere al menos un nombre de empresa, un nombre de contacto, un email o un teléfono.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Mapear datos con nombres flexibles y fallbacks
    const company = body.company || body.company_name || body.Company_Name || '';
    const industry = body.industry || body.person_industry || body.Person_Industry || '';

    // Obtener y mapear el tamaño de la empresa (branches)
    const sizeFrom = body.company_size_from || body.Company_Size_From || '';
    const sizeTo = body.company_size_to || body.Company_Size_To || '';
    let branches = body.branches || '';
    if (!branches && (sizeFrom || sizeTo)) {
      branches = `${sizeFrom}-${sizeTo}`.replace(/^-|-$/, '');
    }

    // Concatenar notas de empresa
    const getVal = (val: any): string => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val).trim();
    };

    const website = getVal(body.company_website || body.Company_Website);
    const headline = getVal(body.person_headline || body.Headline);
    const folder = getVal(body.folder_name || body.Folder);
    const extraNotes = getVal(body.notes);
    const location = getVal(body.location || body.person_location || body.city || body.state || body.person_city || body.person_state);
    const companyLinkedin = getVal(body.company_linkedin_url || body.Company_Linkedin_Url);
    const country = getVal(body.country || body.person_country || body.pais);

    let skillsStr = '';
    const rawSkills = body.skills || body.Skills;
    if (rawSkills) {
      if (Array.isArray(rawSkills)) {
        skillsStr = rawSkills.map(s => getVal(s)).filter(Boolean).join(', ');
      } else {
        skillsStr = getVal(rawSkills);
      }
    }

    const notesArr = [];
    if (website) notesArr.push(`Website: ${website}`);
    if (headline) notesArr.push(`Headline: ${headline}`);
    if (folder) notesArr.push(`Folder: ${folder}`);
    if (location) notesArr.push(`Ubicación: ${location}`);
    if (companyLinkedin) notesArr.push(`LinkedIn Empresa: ${companyLinkedin}`);
    if (skillsStr) notesArr.push(`Habilidades: ${skillsStr}`);
    if (extraNotes) notesArr.push(`Notas adicionales: ${extraNotes}`);
    const companyNotes = notesArr.join('\n');

    // Contacto
    const firstName = body.first_name || body.First_Name || '';
    const lastName = body.last_name || body.Last_Name || '';

    // Buscar primer email disponible
    const email1 = body.email_1 || body.Email_1 || body.email || '';
    const email2 = body.email_2 || body.Email_2 || '';
    const email = email1 || email2 || '';

    // Buscar primer teléfono disponible
    const phone1 = body.phone_1 || body.Phone_1 || body.phone || '';
    const phone2 = body.phone_2 || body.Phone_2 || '';
    const phone = phone1 || phone2 || '';

    const position = body.position || body.current_position || body.Current_Position || '';
    const linkedinUrl = body.linkedin_url || body.person_linkedin_url || body.Person_Linkedin_Url || '';

    // Elegir medio de contacto inicial en base a los datos existentes
    const medioContacto = phone ? 'whatsapp' : 'email';

    // Determinar si el teléfono viene validado de origen (SalesQL)
    const phone1Status = body.phone_1_status || body.Phone_1_Status || '';
    const telefonoValidado = (
      phone1Status === 'valid' || 
      phone1Status === 'verified' || 
      body.phone_verified === true || 
      body.phone_verified === 'true'
    );

    // 5. Invocar la función RPC transaccional
    console.log(`Ejecutando import_salesql_lead para la empresa "${company || 'Sin Empresa'}"`);
    const { data, error: rpcError } = await supabase.rpc('import_salesql_lead', {
      p_company: company,
      p_industry: industry,
      p_branches: branches,
      p_company_notes: companyNotes,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_phone: phone,
      p_position: position,
      p_linkedin_url: linkedinUrl,
      p_medio_contacto: medioContacto,
      p_telefono_validado: telefonoValidado,
      p_country: country
    });

    if (rpcError) {
      console.error('Error de base de datos en RPC:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Database transaction failed', details: rpcError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data && data.success === false) {
      console.error('Fallo lógico en RPC:', data.error);
      return new Response(
        JSON.stringify({ error: 'Logic processing failed', details: data }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead importado con éxito:', JSON.stringify(data));
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Error parsing JSON or running execution:', err);
    return new Response(
      JSON.stringify({ error: 'Invalid request body', details: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
