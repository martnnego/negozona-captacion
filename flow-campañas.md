Dentro de **Campañas**:

```
+ Nueva campaña

--------------------------------------------------------------
Nombre           Canal      Estado      Fecha      Destinatarios
--------------------------------------------------------------
Promo Julio      WhatsApp   Programada  28/07      352
Newsletter #15   Email      Enviada     25/07      1845
Reactivación     WhatsApp   Borrador    -
Clientes VIP     Email      En curso    Hoy        612
```

Al abrir una campaña verías pestañas como:

```
General
Audiencia
Contenido
Programación
Resultados / Metricas (Ver API mensajes de marketing)
Actividad
```

---

# Asistente de creación

Lo haría en 6 pasos.

## Paso 1 – Información general

```
Nombre

Descripción

Canal
( ) WhatsApp
( ) Email

Objetivo de campaña:

○ Promoción

○ Difusión

○ Reactivación

○ Fidelización

○ Recordatorio

○ Seguimiento comercial

○ Notificación

○ Otro
```

Cuando elegís el canal recién ahí cambia el resto del asistente.

---

## Paso 2 – Audiencia

Acá pondría mucho esfuerzo porque va a ser uno de los diferenciales.

```
○ Todos los contactos

○ Segmento guardado

○ Crear segmento dinámico (Segmento que filtra los usuarios al momento de llegar la hora de enviar la camáña)
```

Por ejemplo:

```
Etapa = En proceso

AND

Última gestión > 15 días
```

A la derecha:

```
Resultado

238 contactos potenciales o reales

+15 desde ayer

-3 hoy
```

Es decir, el segmento es dinámico y el usuario ya ve cuántos destinatarios potenciales habrá. Puede cambiar porque los leads pueden cambiar de atributos hasta la fecha programada de envío.

---

## Paso 3 – Contenido

Este paso cambia según el canal.

### WhatsApp

```
Plantilla (La buscamos en meta usando la api de meta - Similar a como esta en la sección del modal lead/Whatsapp)

▼ Bienvenida Comercial

Idioma

es_AR

Variables (Cambian dinamicamente según lo que venga desde meta cuando elegimos la plantilla)

{{nombre}}

{{empresa}}

{{vendedor}}

Vista previa
```

---

### Email

```
Por ahora indicar que las plantillas de email se estan desarrollando y que la funcionalidad no esta disponible.

---

## Paso 4 – Configuración del envío

Acá uniría la lógica para ambos canales.

```
Enviar

○ Ahora

○ Programado

Fecha

Hora
```



## Paso 5 – Opciones

Solo aparecen las compatibles con el canal.

### WhatsApp

```
☑ Detener ante error masivo

☑ Reintentar automáticamente

☑ Enviar solo a contactos con WhatsApp válido
```

### Email

```
☑ Reintentar soft bounce

☑ Tracking de aperturas

☑ Tracking de clics

☑ Agregar enlace de baja
```

---

## Paso 6 – Resumen

```
Nombre

Canal

Audiencia

Proveedor

Fecha

Hora

Costo estimado

Vista previa
```

Botón:

```
Programar campaña
```

---

# Lo que más me gusta de este diseño

Hay una sola entidad: **Campaña**.

Internamente podría verse así:

```
Campaña
│
├── Información
│
├── Canal
│      ├── WhatsApp
│      └── Email
│
├── Audiencia
│
├── Contenido
│
├── Programación
│
└── Resultados
```


