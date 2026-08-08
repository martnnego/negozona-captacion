# Módulo de Mailing B2B

## 1. Integración con Google Workspace

**Objetivo:** permitir que el CRM envíe y procese emails utilizando las cuentas corporativas de los comerciales.

### Arquitectura

```text
Google Cloud
   │
   └── Service Account
          │
          │ Domain-Wide Delegation
          ▼
   Google Workspace
          │
     ┌────┼────┐
     ▼    ▼    ▼
   Juan María Pedro
     │    │    │
     └────┼────┘
          ▼
      Gmail API
```

### Requerimientos

- Service Account en Google Cloud.
- Domain-Wide Delegation.
- Autorización del administrador de Workspace.
- Scopes mínimos necesarios:
  - `gmail.send`
  - `gmail.readonly`
- El CRM debe poder impersonar a cada comercial autorizado.
- No se almacenan contraseñas ni tokens OAuth individuales.
- La Service Account y sus credenciales las creará el desarrollador manualmente desde gcloud pero deben almacenarse de forma segura.

---

# 2. Gestión de cuentas remitentes

En el CRM debe existir una relación entre:

```text
Usuario CRM
      ↕
Cuenta Google Workspace
```

Ejemplo:

| Usuario | Email | Estado |
|---|---|---|
| Juan Pérez | juan@empresa.com | Activo |
| María López | maria@empresa.com | Activo |
| Pedro Gómez | pedro@empresa.com | Activo |

El sistema debe validar que la cuenta pertenece al dominio autorizado.

---

# 3. Envío individual

Desde un lead/contacto en una solapa adicional llamada Mailing:

```text
Contacto
   ↓
Enviar email
   ↓
Seleccionar plantilla / redactar
   ↓
Seleccionar comercial
   ↓
Enviar
```

Características:

- Asunto.
- HTML.
- Texto plano.
- Variables dinámicas.
- Adjuntos, si se requieren.
- Remitente comercial.
- Reply-To, si corresponde.
- Registro de la actividad.

Ejemplo:

```text
De: juan@empresa.com
Para: cliente@otraempresa.com

Asunto: Propuesta para {{empresa}}
```

Además: Agregar las gestiones de mailing como registros a visualizarse en la sección gestiones.

---

# 4. Plantillas

Módulo de plantillas reutilizables.

Una plantilla tendrá:

- Nombre.
- Asunto.
- Cuerpo HTML.
- Cuerpo texto.
- Variables.
- Estado activo/inactivo.

Ejemplo:

```text
Hola {{nombre}},

Soy {{comercial}} de {{empresa}}.

Quería contactarte porque...
```

El sistema deberá reemplazar automáticamente las variables antes del envío.

---

# 5. Campañas

Permitir crear campañas de email para múltiples contactos. Verificar que la funcionalidad se complemente la el abm de campañas actual, siguiento el flujo de trabajo del modal actual pero que cambie de pasos al seleccionar la fuente "Email" en lugar de whatsapp.

Configuración:

```text
Campaña
├── Nombre
├── Segmento
├── Plantilla
├── Remitente/s
├── Fecha de inicio
├── Horario
├── Límite diario
└── Estado
```

Estados:

- Borrador.
- Programada.
- En curso.
- Pausada.
- Finalizada.
- Cancelada.

Las campañas utilizarán una **cola de envíos**, no un loop que intente enviar todos los emails simultáneamente.

---

# 6. Distribución entre comerciales

Una campaña puede asignar contactos a uno o varios comerciales que actuen como remitentes. Esto no afecta quien tiene asignado el contacto.

Ejemplo:

```text
Campaña: Prospectos agosto

Juan       → 100 contactos
María      → 100 contactos
Pedro      → 80 contactos
```

Cada email se enviará desde la cuenta correspondiente.

El sistema deberá controlar límites por cuenta.

Duda: si lo ves muy rebuscado para un mvp esta funcionalidad la pausamos y posponemos para mas adelante.

---

# 7. Scheduler + Queue + Worker

Arquitectura:

```text
Campaña
   ↓
Generador de cola
   ↓
EMAIL_QUEUE
   ↓
Worker
   ↓
Gmail API
```

La cola debería registrar como mínimo:

```text
email_id
contact_id
lead_id
campaign_id
commercial_id
scheduled_at
status
attempts
sent_at
error
gmail_message_id
thread_id
```

Esto permite reintentos, pausas, control de errores y trazabilidad.

---

# 8. Tracking de aperturas

Cada email enviado por el CRM incorporará un **pixel único**. Podría estar en el logo de Negozona o algo similar.

```text
Email
  ↓
<img src="/tracking/open/{email_event_id}">
  ↓
CRM
  ↓
OPEN_DETECTED
```

Registrar:

- Email.
- Contacto.
- Campaña.
- Comercial.
- Fecha/hora.
- Datos técnicos disponibles.
- Cantidad de aperturas.

La métrica debe denominarse **"apertura detectada"**, no "email leído", porque los clientes de correo pueden precargar imágenes.

---

# 9. Tracking de clicks

Los links de los emails podrán convertirse automáticamente en links trackeables:

```text
Email
  ↓
/tracking/click/{id}
  ↓
Registrar CLICK
  ↓
Redirect
  ↓
URL original
```

Registrar:

- Email.
- Contacto.
- Campaña.
- Comercial.
- URL.
- Fecha/hora.

Esto permite saber qué contactos interactuaron realmente con la propuesta. Puede que una plantilla no tenga CTA.

---

# 10. Registro de respuestas

**Sí lo incluiría.**

Pero no como sincronización completa del Inbox.

El objetivo es:

> Detectar respuestas relacionadas con emails enviados desde el CRM.

Arquitectura:

```text
Cliente responde
       ↓
Gmail del comercial
       ↓
Gmail API / Watch
       ↓
CRM
       ↓
¿Está relacionado con un email del CRM?
       ↓
      Sí
       ↓
Registrar REPLY
```

Guardar:

- `gmail_message_id`
- `thread_id`
- email original
- contacto
- lead
- comercial
- fecha/hora
- asunto
- contenido/snippet según política definida.

Inicialmente **no mostraría toda la bandeja de entrada dentro del CRM**. Debe mostrarse en el modal de lead.

---

# 11. Timeline del contacto

Todos los eventos deberían terminar en la actividad del contacto/lead en la sección historial y tambien en gestiones de entrada y salida:

```text
04/08 09:15  📧 Email enviado
04/08 10:02  👁 Apertura detectada
04/08 10:05  🔗 Click en propuesta
04/08 11:34  ↩️ Respuesta recibida
```

Este debería ser uno de los principales puntos de integración con el CRM.

---

# 12. Estados del email

Se recomienda definir un modelo de eventos separado del estado del email.

### Estado principal

```text
QUEUED
SCHEDULED
SENDING
SENT
FAILED
```

### Eventos

```text
OPEN_DETECTED
CLICKED
REPLIED
BOUNCED
```

Esto es mejor que intentar que un email tenga un único estado:

> `SENT → OPENED → CLICKED → REPLIED`

porque un mismo email puede tener **múltiples aperturas y clicks**.

---

# 13. Estadísticas (Las ubicaría en una opcion del menu de marketing - Estadísticas Mailing)

## Campaña

- Total destinatarios.
- Enviados.
- Fallidos.
- Rebotes.
- Aperturas detectadas.
- Clicks.
- Respuestas.
- % apertura detectada.
- % click.
- % respuesta.
- % rebote.

## Comercial

Comparación de actividad entre comerciales:

```text
Comercial | Enviados | Aperturas | Clicks | Respuestas
Juan      | 120      | 65        | 18     | 9
María     | 100      | 52        | 15     | 7
```
## Limites consumos cuota Gmail

Mostraría estadísticas de mails totales, consumidos y restantes de la cuota de workspace que ofrece gmail.

## Contacto

Timeline completo de interacciones.

---

# 14. Automatizaciones futuras - No se desarrolla en esta primera etapa

La arquitectura debería quedar preparada para reglas como:

```text
SI
email abierto
Y
no hubo respuesta
DURANTE 2 días

ENTONCES
crear tarea para comercial
```

o:

```text
SI
contacto hizo click en propuesta

ENTONCES
cambiar etapa → Interesado
```

o:

```text
SI
no abrió email durante 3 días

ENTONCES
enviar follow-up
```

Esto no necesariamente forma parte del MVP, pero **la estructura debería permitirlo**.

---

# 15. MVP propuesto

## Fase 1 — Infraestructura

- Google Cloud.
- Service Account.
- Domain-Wide Delegation.
- Gmail API.
- Impersonación de usuarios.
- Envío desde cuentas de comerciales.

## Fase 2 — Mailing

- Envío individual.
- Plantillas.
- Variables.
- Registro de emails.
- Cola.
- Scheduler.
- Worker.
- Manejo de errores/reintentos.

## Fase 3 — Tracking

- Tracking de aperturas.
- Tracking de clicks.
- Registro de eventos.
- Timeline del contacto.

## Fase 4 — Respuestas

- Gmail Watch.
- Pub/Sub.
- Detección de respuestas.
- Asociación con lead/contacto/email.
- Registro en timeline.

## Fase 5 — Campañas

- Segmentación.
- Distribución entre comerciales. No la veo necesaria por ahora.
- Programación.
- Límites por cuenta. Ver estadísticas.
- Pausa/reanudación.
- Estadísticas.

---

# Concepto central

> **No estamos construyendo un "Mailchimp". Estamos construyendo un motor de comunicación B2B integrado al CRM. Gmail/Workspace es el proveedor de correo; el CRM es el que administra contactos, campañas, cola, tracking, respuestas y actividad comercial.**

Un email individual enviado desde la ficha de un lead y un email enviado dentro de una campaña deberían ser técnicamente el mismo objeto `email_activity`. Esto simplifica las estadísticas, automatizaciones y el timeline del lead.
