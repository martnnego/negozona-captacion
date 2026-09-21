// Historial estructurado de versiones y novedades del CRM Negozona
export const CHANGELOG = [
  {
    version: '1.4.0',
    date: 'Septiembre 2026',
    title: 'Selector de Pipeline (Negozona / Franquiday), Filtro de Contactos y Vista Previa HTML en Campañas',
    tag: 'Nuevo',
    summary: 'Mejoramos el creador de campañas con soporte dual para etapas de Negozona y Franquiday, control para enviar solo al contacto principal o a todos los contactos, alertas de variabilidad de audiencia y vista previa HTML interactiva y colapsable en plantillas de email.',
    changes: [
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Selector de Pipeline en Audiencia: permite elegir entre el pipeline comercial de Negozona o Franquiday para filtrar leads según sus respectivas etapas.'
      },
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Control de Contacto Principal: opción para definir si la campaña se envía exclusivamente al contacto principal del lead o a todos los contactos asociados.'
      },
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Vista Previa HTML Real y Colapsable en Campañas de Email: visualización fiel del correo electrónico en un contenedor desplegable, con reemplazo automático de variables de muestra.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Alertas informativas en segmentos dinámicos que indican la variabilidad del volumen de envíos ante cambios de etapa posteriores.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Actualización en los motores de envío de WhatsApp e Email en Supabase para sincronizar el pipeline de Franquiday y la restricción de contacto principal.'
      }
    ]
  },
  {
    version: '1.3.0',
    date: 'Septiembre 2026',
    title: 'Tipo de Lead (Franquicia / Sponsor) y Habilidades UI para Agente de WhatsApp',
    tag: 'Nuevo',
    summary: 'Incorporamos la diferenciación y segmentación de leads por Tipo (Franquicia o Sponsor), junto con la nueva solapa de Habilidades UI en WhatsApp Cloud API para crear y gestionar mensajes interactivos con botones CTA, carruseles, listas desplegables y WhatsApp Flows.',
    changes: [
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Segmentación por Tipo de Lead: clasificación en Franquicia y Sponsor con etiquetas visuales, filtros combinados en vistas Tabla y Kanban, y selector en la ficha del lead.'
      },
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Solapa "Habilidades UI" en WhatsApp Cloud API: configuración directa con Meta de mensajes interactivos (botones URL/CTA, respuestas rápidas, carruseles, listas y WhatsApp Flows).'
      },
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Guía interactiva de componentes UI con plantillas de ejemplo listas para usar y vinculación directa con WhatsApp Flows publicados.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Normalización automática de identificadores técnicos y slugs en habilidades UI para garantizar compatibilidad con Meta Cloud API.'
      }
    ]
  },
  {
    version: '1.2.1',
    date: 'Septiembre 2026',
    title: 'Mejoras en estadísticas de mailing, gestiones de email y validación de contactos',
    tag: 'Mejoras',
    summary: 'Incorporamos ordenamiento por columnas en estadísticas de mailing, enlaces directos a fichas de leads, optimización visual de emails en gestiones y corrección de validación de emails duplicados.',
    changes: [
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Sistema de notificaciones de versiones y nuevas funcionalidades en el CRM.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Ordenamiento interactivo por columnas en todas las tablas de Estadísticas de Mailing.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Enlace directo al detalle del lead y columna de template de email con vista previa en Estadísticas.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Diseño compacto y desplegable para emails salientes en la solapa de Gestiones del lead.'
      },
      {
        type: 'arreglo',
        badge: 'Arreglo',
        text: 'Limpieza automática de contactos huérfanos y reutilización de emails sin falsos duplicados al eliminar leads.'
      }
    ]
  },
  {
    version: '1.2.0',
    date: 'Septiembre 2026',
    title: 'Notas de voz en WhatsApp, buscador SalesQL y feedback integrado',
    tag: 'Mayor',
    summary: 'Incorporamos reproducción de notas de voz en los chats de WhatsApp, un buscador directo de contactos SalesQL y un canal de feedback para mejorar el CRM juntos.',
    changes: [
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Reproducción de audios y notas de voz directamente desde el historial de WhatsApp del lead.'
      },
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Buscador de contactos con SalesQL integrado para enriquecer datos de empresas y directivos.'
      },
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Botón de "Feedback" en la barra superior para enviarle sugerencias o reportes directos al equipo.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Control de lista blanca de WhatsApp y cupo máximo de 20 números para pruebas seguras.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Optimización de velocidad en la carga inicial del CRM y en el procesamiento de campañas.'
      }
    ]
  },
  {
    version: '1.1.0',
    date: 'Agosto 2026',
    title: 'Automatizaciones comerciales y recursos compartidos',
    tag: 'Mejoras',
    summary: 'Sumamos soporte para automatizar tareas repetitivas al cambiar de etapa y una sección de recursos para adjuntar presentaciones y fichas técnicas.',
    changes: [
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Módulo de Automatizaciones: ejecución automática de mensajes o tareas al mover leads entre etapas.'
      },
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Sección de Recursos en Configuración para subir y compartir presentaciones y documentos comerciales.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Soporte de imágenes y cabeceras multimedia en plantillas oficiales de WhatsApp.'
      },
      {
        type: 'mejora',
        badge: 'Mejora',
        text: 'Notificaciones sonoras y alertas visuales en tiempo real ante nuevas gestiones sobre tus leads.'
      }
    ]
  },
  {
    version: '1.0.0',
    date: 'Julio 2026',
    title: 'Lanzamiento oficial de Negozona CRM Expansión',
    tag: 'Lanzamiento',
    summary: 'Primera versión del CRM enfocado en la prospección, gestión y seguimiento integral de franquicias y oportunidades comerciales.',
    changes: [
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Pipeline visual en formato Kanban y vista en Tabla con filtros avanzados y estados de gestión.'
      },
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Módulo de Mailing B2B con plantillas personalizadas, seguimiento de aperturas y estadísticas.'
      },
      {
        type: 'nuevo',
        badge: 'Nuevo',
        text: 'Sincronización multi-usuario en tiempo real mediante Supabase.'
      }
    ]
  }
];

export const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.0';

export function getLatestRelease() {
  return CHANGELOG[0] || null;
}

export function getReleaseByVersion(version) {
  return CHANGELOG.find(item => item.version === version) || null;
}
