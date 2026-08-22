const es = {
  common: {
    user: "Usuario",
    executionCount: {
      one: "{{count}} ejecución",
      other: "{{count}} ejecuciones",
    },
  },
  language: {
    selectorLabel: "Idioma",
    spanish: "Español",
    english: "Inglés",
    switchTo: "Cambiar idioma a {{language}}",
  },
  nav: {
    newAnalysis: "Nuevo análisis",
    history: "Historial",
    tutorial: "Cómo funciona",
    supervision: "Supervisión",
    administration: "Administración",
  },
  roles: {
    admin: "Administrador",
    teacher: "Profesor",
    student: "Estudiante",
  },
  navbar: {
    brandAria: "Performance System — Nuevo análisis",
    mainNavigationAria: "Navegación principal",
    mobileNavigationAria: "Navegación móvil",
    themeToLight: "Cambiar a tema claro",
    themeToDark: "Cambiar a tema oscuro",
    profile: "Mi perfil",
    logout: "Cerrar sesión",
    openNavigation: "Abrir navegación",
    closeNavigation: "Cerrar navegación",
  },
  login: {
    logoAlt: "Logo Performance System",
    brandSubtitle:
      "Plataforma para medir y analizar el rendimiento de código C++ usando métricas de hardware reales.",
    highlights: {
      analysisLead: "Análisis de rendimiento para",
      benchmarks: "LCS, CAMM y SIZE",
      metricsLead: "Métricas avanzadas:",
      metrics: "IPC, caché, energía, ciclos",
      integrationLead: "Integración con cuentas institucionales",
      accounts: "@inf.udec.cl y @udec.cl*",
    },
    note: {
      standardLead: "El acceso estándar es con tu correo",
      otherLead:
        "Si perteneces a otra carrera de la UdeC, puedes solicitar acceso con tu correo",
      formSuffix: "usando el formulario de esta página.",
    },
    title: "Acceso institucional",
    subtitle: {
      lead: "Ingresa con tu cuenta institucional:",
      direct: "(acceso directo) o",
      approval: "(previa aprobación).",
    },
    google: {
      redirecting: "Redirigiendo a Google...",
      continue: "Continuar con Google",
      hintLead:
        "Se utilizará tu cuenta institucional para autenticarte de forma segura. Si tu correo pertenece a",
      hintImmediate: "el acceso es inmediato. Si usas",
      hintRequest: "primero debes solicitar acceso y esperar la aprobación.",
    },
    accessRequestDivider: "Solicitud de acceso (correo @udec.cl)",
    fields: {
      fullName: "Nombre completo",
      fullNamePlaceholder: "Nombre Apellido",
      institutionalEmail: "Correo institucional UdeC",
      professorEmail: "Correo del profesor responsable",
      course: "Curso / Asignatura",
      coursePlaceholder: "Ej: INF-253 Estructuras de Datos",
      comment: "Comentario",
      commentPlaceholder:
        "Explica brevemente por qué necesitas acceso (2–3 líneas).",
      optional: "opcional",
    },
    validation: {
      fullNameRequired: "El nombre completo es obligatorio.",
      emailRequired: "El correo institucional es obligatorio.",
      emailDomain:
        "Este formulario es solo para correos institucionales @udec.cl.",
      professorRequired:
        "Debe indicar el correo del profesor responsable.",
      professorInvalid:
        "El correo del profesor no parece ser válido.",
    },
    request: {
      submit: "Enviar solicitud de acceso",
      submitting: "Enviando solicitud...",
      success:
        "Solicitud enviada correctamente. Cuando tu cuenta sea aprobada, podrás ingresar usando 'Continuar con Google' con el mismo correo @udec.cl.",
      pending:
        "Ya existe una solicitud pendiente para este correo.",
      emailRejected:
        "No fue posible validar el correo institucional. Revísalo e intenta nuevamente.",
      professorRejected:
        "No fue posible validar el correo del profesor responsable. Revísalo e intenta nuevamente.",
      error:
        "Ocurrió un error al enviar la solicitud. Intenta nuevamente.",
      metaLead:
        "Al enviar esta solicitud, un administrador revisará tu caso. Cuando tu cuenta sea aprobada, podrás ingresar usando",
      metaSuffix: "con el mismo correo",
    },
    footer: {
      lead:
        "¿Problemas para acceder? Contacta al docente responsable del ramo o al administrador del laboratorio",
      example: "(ej: josefuentes@inf.udec.cl).",
    },
    auth: {
      generic:
        "No fue posible completar el inicio de sesión. Intenta nuevamente.",
      invalidOauthState:
        "La solicitud de inicio de sesión expiró o no es válida. Intenta nuevamente.",
      googleAuthError:
        "No fue posible completar el inicio de sesión con Google.",
      missingAuthCode:
        "Google no entregó la información necesaria para iniciar sesión.",
      missingIdToken:
        "No fue posible validar tu identidad con Google.",
      externalDomain:
        "Este correo no pertenece a un dominio institucional permitido.",
      accessRequired:
        "Tu correo necesita una solicitud de acceso antes de poder ingresar.",
      accessPending:
        "Tu solicitud de acceso todavía está pendiente de aprobación.",
      accountDisabled:
        "Tu cuenta está deshabilitada. Contacta al responsable del sistema.",
      accessDenied:
        "No fue posible autorizar el acceso con esta cuenta.",
    },
  },

  history: {
    eyebrow: "Trabajo persistido",
    title: "Historial",
    description: "Recupera tus experimentos anteriores y vuelve a sus ejecuciones, resultados y trazabilidad.",
    newAnalysis: "Nuevo análisis",
    filtersAria: "Filtros del historial",
    filtersTitle: "Filtrar experimentos",
    filtersHint: "Los filtros se aplican sobre todo tu historial, antes de paginar los resultados.",
    clearFilters: "Limpiar filtros",
    search: "Buscar",
    searchHint: "Título, archivo ZIP, archivo .cpp o nota",
    searchPlaceholder: "Ej. ordenamiento, sorting.zip, merge.cpp, referencia base",
    referencesOnly: "Solo referencias",
    status: "Estado",
    filterByStatus: "Filtrar por estado",
    allStatuses: "Todos los estados",
    benchmark: "Benchmark",
    filterByBenchmark: "Filtrar por benchmark",
    allBenchmarks: "Todos los benchmarks",
    context: "Contexto",
    filterByCourse: "Filtrar por curso",
    allContexts: "Todos los contextos",
    personal: "Personal",
    summaryAria: "Resumen del historial",
    resultsFound: "Resultados encontrados",
    registeredExperiments: "Experimentos registrados",
    page: "Página",
    of: "de",
    loadingTitle: "Cargando historial",
    loadingText: "Consultando tus experimentos persistidos.",
    loadErrorTitle: "No pudimos cargar tu historial",
    retry: "Reintentar",
    emptyFilteredTitle: "No encontramos experimentos",
    emptyTitle: "Aún no tienes experimentos registrados",
    emptyFilteredText: "Prueba con otros criterios o limpia los filtros para volver a ver todo tu historial.",
    emptyText: "Cuando ejecutes un análisis, aparecerá aquí para que puedas revisarlo posteriormente.",
    createFirstAnalysis: "Crear primer análisis",
    experimentsAria: "Experimentos",
    experimentNumber: "Experimento #{{id}}",
    untitledExperiment: "Experimento sin título",
    reference: "Referencia",
    file: "Archivo",
    zipUnavailable: "ZIP no disponible",
    lastActivity: "Última actividad",
    implementations: "Implementaciones",
    sources: "Fuentes",
    sourcesUnavailable: "Fuentes no disponibles",
    moreSources: "+{{count}} más",
    benchmarkUnavailable: "Benchmark no informado",
    viewExperiment: "Ver experimento",
    paginationAria: "Paginación del historial",
    previous: "Anterior",
    next: "Siguiente",
    noRecord: "Sin registro",
    noCourse: "Sin curso asociado",
    semester: "Semestre",
    states: {
      empty: "Sin ejecuciones",
      inProgress: "En progreso",
      completed: "Completado",
      partial: "Parcial",
      failed: "Error",
      cancelled: "Cancelado",
    },
    errors: {
      load: "No fue posible cargar tu historial.",
      incomplete: "El servidor devolvió un historial incompleto.",
      filterOptions: "No fue posible cargar los cursos del historial.",
    },
  },

  profile: {
    semester: "Semestre",
    noPeriod: "Período no disponible",
    courseFallback: "Curso",
    unnamedCourse: "Curso sin nombre",
    teacherUnavailable: "Profesor no disponible",
    period: "Período",
    professor: "Profesor",
    newAnalysisInCourse: "Nuevo análisis en este curso",
    loadingTitle: "Cargando tu perfil",
    loadingText: "Consultando actividad y resumen de ejecuciones.",
    eyebrow: "Mi perfil",
    loadErrorTitle: "No pudimos cargar tu información",
    retry: "Reintentar",
    accountEyebrow: "Cuenta personal",
    title: "Mi perfil",
    description:
      "Revisa tu identidad institucional y un resumen de la actividad registrada en Performance System.",
    newAnalysis: "Nuevo análisis",
    noEmail: "Sin correo registrado",
    accountCreated: "Cuenta creada",
    lastSession: "Última sesión",
    lastExecution: "Última ejecución",
    academicContext: "Contexto académico",
    coursesTitle: "Cursos para mis análisis",
    coursesDescription:
      "Cursos activos en los que puedes asociar nuevos experimentos.",
    coursesLoadingTitle: "Cargando tus cursos",
    coursesLoadingText: "Consultando tu contexto académico activo.",
    coursesLoadErrorTitle: "No pudimos cargar tus cursos",
    retryCourses: "Reintentar cursos",
    noCoursesTitle: "Actualmente no tienes cursos activos.",
    noCoursesText:
      "Puedes realizar un análisis personal sin asociarlo a un curso.",
    startPersonalAnalysis: "Iniciar análisis personal",
    activity: "Actividad",
    usageSummary: "Resumen de uso",
    usageDescription:
      "Las cifras se calculan desde tus experimentos y ejecuciones persistidas.",
    metrics: {
      submissions: "Experimentos",
      submissionsHint: "Experimentos registrados",
      executions: "Ejecuciones",
      executionsHint: "Ejecuciones totales",
      completed: "Completadas",
      completedHint: "Con procesamiento finalizado",
      failed: "Fallidas",
      failedHint: "Con fallo registrado",
    },
    executionsEyebrow: "Ejecuciones",
    currentState: "Estado actual",
    active: "En curso",
    queued: "En cola",
    running: "En ejecución",
    processing: "Procesando",
    cancelled: "Canceladas",
    latestActivity: "Última actividad",
    latestExecution: "Ejecución más reciente",
    status: "Estado",
    date: "Fecha",
    duration: "Duración",
    viewExperiment: "Ver experimento",
    viewLastResult: "Ver último resultado",
    viewFullHistory: "Ver historial completo",
    noFinalResult:
      "La ejecución más reciente todavía no tiene un resultado final disponible.",
    firstAnalysisState:
      "Cuando completes tu primer análisis, aquí aparecerá su estado.",
    institutionalData: "Datos institucionales",
    institutionalDataText:
      "El nombre, correo y rol mostrados provienen de tu cuenta registrada en el sistema. No se editan desde esta pantalla.",
    noRecord: "Sin registro",
    noData: "Sin datos",
    accountStatus: {
      active: "Activo",
      inactive: "Inactivo",
    },
    roles: {
      admin: "Administrador",
      teacher: "Profesor",
      student: "Estudiante",
      user: "Usuario",
    },
    executionStates: {
      none: "Sin ejecuciones",
      queued: "En cola",
      running: "En ejecución",
      processing: "Procesando",
      completed: "Completado",
      failed: "Error",
      cancelled: "Cancelado",
      unavailable: "No disponible",
    },
    errors: {
      load: "No fue posible cargar tu perfil.",
      incomplete: "El servidor devolvió un perfil incompleto.",
      courses: "No fue posible cargar tus cursos activos.",
    },
  },

  renderForm: {
    header: {
      eyebrow: "Experimento de rendimiento",
      exampleLink: "¿Necesitas un ejemplo? Ver ejemplos de código",
    },
    upload: {
      testNameLabel: "Nombre del test",
      testNamePlaceholder: "Ej: LCS optimizado, CAMM bloqueado, etc.",
      testNameHelp:
        "Este nombre identifica el Experimento. Un ZIP puede contener varias implementaciones y cada archivo .cpp genera su propia ejecución.",
      noteLabel: "Nota personal",
      optional: "(opcional)",
      notePrivate: "Solo tú podrás ver esta nota.",
      characters: "{{count}} / {{max}} caracteres",
      archiveLabel: "Archivo de código (.zip)",
      selectAria: "Seleccionar archivo de código ZIP",
      dropTitle: "Arrastra y suelta el .zip aquí",
      dropHint: "o haz clic para seleccionar un archivo desde tu equipo.",
      maxHint:
        "Máx recomendado: {{max}} MB. El .zip debe contener al menos un archivo .cpp.",
      inspecting: "Analizando contenido…",
      cppFiles: {
        one: "{{count}} archivo .cpp",
        other: "{{count}} archivos .cpp",
      },
      examplesInside: "Ejemplos dentro del .zip:",
    },
    measurement: {
      environmentLabel: "Entorno de ejecución",
      environmentName: "Entorno de medición administrado",
      automaticBadge: "Automático",
      environmentDescription:
        "Las ejecuciones se envían al nodo de medición configurado para esta instalación.",
      environmentNote:
        "El entorno administrado y controlado favorece la comparabilidad y reproducibilidad, y reduce variaciones atribuibles a hardware no controlado. La procedencia del hardware se registra cuando está disponible.",
      profileLabel: "Perfil de medición",
      profileHelp:
        "Define cuántas veces se repite cada punto de medición. Más repeticiones suelen entregar resultados más estables, pero aumentan el tiempo total del experimento.",
      repetitions: {
        one: "{{count}} repetición por punto",
        other: "{{count}} repeticiones por punto",
      },
      manualRepetitions: "Repeticiones definidas manualmente",
      profiles: {
        rapido: {
          name: "Rápido",
          badge: "Exploración",
          description:
            "Útil para comprobar rápidamente el comportamiento general antes de realizar una medición más extensa.",
        },
        equilibrado: {
          name: "Equilibrado",
          badge: "Recomendado",
          description:
            "Balance entre tiempo de ejecución y estabilidad de las mediciones. Es la opción recomendada para uso general.",
        },
        exhaustivo: {
          name: "Exhaustivo",
          badge: "Mayor estabilidad",
          description:
            "Aumenta las repeticiones para observar con mayor estabilidad la variabilidad entre mediciones.",
        },
        personalizado: {
          name: "Personalizado",
          badge: "Control manual",
          description:
            "Permite definir manualmente el número de repeticiones por punto de medición.",
        },
      },
    },
    benchmark: {
      sectionLabel: "Tipo de benchmark y parámetros",
      sectionHelp:
        "Selecciona el tipo de entrada que mejor representa el algoritmo que quieres analizar. Performance System utilizará el benchmark asociado para generar los distintos puntos de medición.",
      maxInput: "Tamaño máximo de entrada",
      repetitionsPerPoint: "Repeticiones por punto de medición",
      decreaseRepetitions: "Disminuir repeticiones",
      increaseRepetitions: "Aumentar repeticiones",
      currentProfile:
        "El perfil actual es {{profile}}. Los valores 10, 30 y 50 corresponden a Rápido, Equilibrado y Exhaustivo; otros valores se registran como Personalizado.",
      fixedByProfile: "Definido por el perfil {{profile}}.",
      customProfileHelp:
        "El perfil Personalizado permite elegir entre 1 y 100 repeticiones por punto.",
      repetitionsSlider: "Repeticiones por punto",
      allowedRange:
        "Rango permitido: {{min}}–{{max}}. Es un límite de aceptación, no una garantía de tiempo de ejecución.",
      recommendedValues: "Valores recomendados",
      advancedInputTitle: "Tamaño avanzado",
      advancedInputWarning:
        "Supera el mayor valor recomendado ({{recommendedMax}}). El experimento puede tardar mucho o alcanzar el timeout según la implementación y el perfil seleccionado.",
      dataDistribution: "Distribución de los datos",
      dataDistributionHelp:
        "Define cómo se organiza el conjunto numérico que recibirá el algoritmo.",
      executionSummary: {
        one: "Cómo se ejecutará: el motor generará varios puntos de medición hasta el tamaño máximo seleccionado y repetirá cada punto {{count}} vez.",
        other: "Cómo se ejecutará: el motor generará varios puntos de medición hasta el tamaño máximo seleccionado y repetirá cada punto {{count}} veces.",
      },
      notApplicable: "No aplica",
      tasks: {
        lcs: {
          name: "Entrada de texto",
          subtitle:
            "Analiza algoritmos que procesan texto utilizando el dataset english.50MB.",
          description:
            "El motor evalúa el programa con tamaños crecientes de entrada tomados desde el dataset de texto. Cada punto se repite según el perfil de medición seleccionado.",
          badge: "Dataset de texto",
          inputHelp:
            "Cantidad máxima de líneas de texto que alcanzará el benchmark.",
        },
        camm: {
          name: "Datos numéricos",
          subtitle:
            "Analiza algoritmos sobre colecciones numéricas con distintas distribuciones.",
          description:
            "El motor evalúa el programa con conjuntos numéricos de tamaño creciente. Puedes elegir la distribución de los datos para estudiar cómo afecta al comportamiento del algoritmo.",
          badge: "Dataset numérico",
          inputHelp:
            "Cantidad máxima de valores numéricos que alcanzará el benchmark.",
        },
        size: {
          name: "Tamaño parametrizado",
          subtitle:
            "Analiza algoritmos cuyo tamaño de problema se entrega como argumento entero.",
          description:
            "El motor ejecuta el programa con valores crecientes del parámetro de entrada. Es útil cuando el algoritmo genera o administra sus datos a partir de un tamaño recibido como argumento.",
          badge: "Argumento entero",
          inputHelp:
            "Valor máximo que se entregará al programa como tamaño del problema.",
        },
      },
      dataTypes: {
        cammr: "Números aleatorios",
        cammso: "Números semiordenados",
        camms: "Números iguales",
      },
    },
    course: {
      context: "Contexto académico",
      noCourse: "Sin curso asociado",
      personal: "Personal",
      noActiveCourses:
        "Actualmente no tienes cursos activos. Puedes realizar un análisis personal igualmente.",
      course: "Curso",
      loading: "Cargando…",
      loadingText: "Consultando tus cursos activos.",
      loadError: "No pudimos cargar tus cursos",
      retry: "Reintentar",
      associatedCourse: "Curso asociado",
      automatic: "Automático",
      professor: "Profesor: {{name}}",
      professorUnavailable: "Profesor no disponible",
      automaticAssociation:
        "Este experimento quedará asociado automáticamente a tu único curso activo.",
      selectCourse: "Selecciona el curso",
      required: "Obligatorio",
      deliveryCourse: "Curso de este experimento",
      selectPlaceholder: "Selecciona un curso…",
      multipleCoursesHelp:
        "Tienes más de un curso activo. Elegirlo evita mezclar experimentos de ramos o semestres distintos.",
    },
    overview: {
      title: "Revisar experimento",
      description:
        "Confirma la configuración antes de enviar el código al entorno de ejecución.",
      experiment: "Experimento",
      name: "Nombre",
      unnamed: "(sin nombre)",
      file: "Archivo",
      noFile: "Ningún archivo seleccionado",
      implementations: "Implementaciones / Fuentes .cpp",
      sources: "Fuentes incluidas",
      moreSources: {
        one: "+{{count}} más",
        other: "+{{count}} más",
      },
      benchmark: "Benchmark",
      parameters: "Parámetros",
      maxSize: "Tamaño máximo",
      range: "rango {{min}}–{{max}}",
      repetitions: "Repeticiones por punto",
      dataDistribution: "Distribución de datos",
      measurement: "Medición",
      environment: "Entorno",
      profile: "Perfil",
      course: "Curso",
      noCourse: "Sin curso asociado",
      user: "Usuario",
      authenticatedSession: "Sesión autenticada",
      back: "Volver y editar",
      sending: "Enviando…",
      confirm: "Confirmar y ejecutar",
    },

    workflow: {
      zip: {
        extension: "El archivo debe tener extensión .zip.",
        tooLarge:
          "El tamaño máximo recomendado es de {{max}} MB. El archivo actual pesa {{size}}.",
        noCpp:
          "El .zip no contiene archivos .cpp. Revisa el contenido antes de volver a subirlo.",
        unreadable:
          "No se pudo leer el contenido del .zip. Inténtalo nuevamente o con otro archivo.",
      },
      polling: {
        missingPersistentId:
          "El servidor no devolvió el identificador persistente de la ejecución.",
        unavailable:
          "No fue posible consultar el estado de la ejecución.",
        notFound: "La ejecución consultada ya no está disponible.",
      },
      ready: {
        kicker: "Resumen",
        title: "Resumen del experimento",
        description:
          "Comprueba la configuración principal antes de iniciar el análisis.",
        readyTitle: "Configuración lista",
        pendingTitle: "Configuración pendiente",
        readyText:
          "Puedes revisar el resumen detallado y confirmar la ejecución.",
        pendingText:
          "Completa estos requisitos para habilitar la revisión:",
        requirements: {
          zipRequired: "Selecciona un archivo ZIP.",
          zipInspecting: "Espera mientras se valida el archivo ZIP.",
          zipInvalid: "Selecciona un archivo ZIP válido que contenga al menos un .cpp.",
          benchmarkRequired: "Elige un benchmark.",
          inputSizeInvalid: "Ingresa un tamaño máximo de entrada válido.",
          samplesInvalid:
            "Define entre 1 y 100 repeticiones para el perfil Personalizado.",
          dataTypeRequired: "Selecciona la distribución de datos para CAMM.",
          courseLoading: "Espera mientras se carga tu contexto académico.",
          courseUnavailable:
            "Reintenta la carga del contexto académico antes de continuar.",
          courseRequired: "Selecciona el curso para este experimento.",
        },
        review: "Revisar y ejecutar",
        clear: "Limpiar configuración",
        hint:
          "Antes de enviar el código verás el resumen detallado para confirmar los parámetros.",
      },
      submitting: {
        kicker: "Iniciando",
        title: "Enviando análisis",
        description: "Estamos registrando el experimento en el servidor.",
        registering: "Registrando solicitud",
        hint: "Este paso suele tardar solo unos segundos.",
      },
      running: {
        kicker: "En ejecución",
        title: "Analizando tu código",
        description:
          "El experimento está avanzando por las distintas etapas de medición.",
        chip: "En curso",
        prepareAnother: "Preparar otro análisis",
        hint:
          "Puedes mantener esta vista abierta mientras se ejecuta el benchmark. Si recargas la página, Performance System intentará recuperar la ejecución.",
        prepareAnotherHint:
          "Preparar otro análisis no cancela esta ejecución: continuará en cola o en medición y podrás seguirla desde Historial.",
      },
      queue: {
        title: "Posición FIFO por ejecución",
        next: "Siguiente en la cola",
        ahead: {
          one: "{{count}} ejecución por delante",
          other: "{{count}} ejecuciones por delante",
        },
        explanation:
          "Las mediciones se despachan en orden FIFO. La posición puede cambiar cuando otras ejecuciones terminan o son reclamadas.",
      },
      events: {
        accepted: "Solicitud aceptada.",
        queued: "Ejecución incorporada a la cola FIFO.",
        running: "El nodo de medición inició la ejecución.",
        processing: "Procesando los resultados de medición.",
        completed: "Resultados disponibles.",
        failed: "La ejecución terminó con un error.",
        failedWithMessage: "La ejecución falló: {{message}}",
        cancelled: "La ejecución fue cancelada.",
      },
      completed: {
        kicker: "Completado",
        title: "Análisis completado",
        description: "Las mediciones fueron procesadas correctamente.",
        chip: "Resultados listos",
        calloutTitle: "Resultados disponibles",
        calloutText:
          "Ya puedes revisar las métricas y visualizaciones generadas para este experimento.",
        viewResults: "Ver resultados",
        newAnalysis: "Nuevo análisis",
      },
      partial: {
        kicker: "Parcial",
        title: "Análisis parcialmente completado",
        description:
          "Algunas implementaciones terminaron correctamente y otras requieren revisión.",
        chip: "Resultados parciales",
        calloutTitle: "Hay resultados disponibles",
        calloutText:
          "Puedes revisar las ejecuciones completadas sin repetir las que ya finalizaron correctamente. El experimento mostrará también qué implementación falló.",
        viewResults: "Ver resultados disponibles",
        newAnalysis: "Nuevo análisis",
      },
      error: {
        kicker: "Incidencia",
        title: "No se pudo completar",
        description:
          "La ejecución terminó con un problema que requiere revisión.",
        chip: "Requiere revisión",
        calloutTitle: "El análisis no finalizó correctamente",
        retryRequest: "Reintentar consulta",
        reviewRetry: "Revisar y volver a intentar",
      },
      summary: {
        code: "Código",
        selectFile: "Selecciona un archivo .zip",
        benchmark: "Benchmark",
        selectBenchmark: "Selecciona un benchmark",
        maxSize: "Tamaño máximo",
        repetitions: "Repeticiones",
        profile: "Perfil",
        environment: "Entorno",
        data: "Datos",
        sentCode: "Código enviado",
      },
      progress: {
        accepted: {
          label: "Solicitud registrada",
          description: "El servidor recibió la solicitud del análisis.",
        },
        queued: {
          label: "En cola",
          description: "El código espera su turno de ejecución.",
        },
        preparing: {
          label: "Preparando ejecución",
          description: "Se prepara el código y el entorno de medición.",
        },
        running: {
          label: "Ejecutando mediciones",
          description: "El benchmark está realizando las mediciones.",
        },
        processing: {
          label: "Procesando resultados",
          description: "Se consolidan las métricas obtenidas.",
        },
        completed: {
          label: "Resultados disponibles",
          description: "El análisis ya puede ser consultado.",
        },
      },
      technical: {
        title: "Detalles técnicos",
        noMessagesYet: " (sin mensajes aún)",
        messageWithoutContent: "Mensaje sin contenido",
        empty:
          "El servidor todavía no ha publicado mensajes adicionales.",
      },
      friendlyErrors: {
        default:
          "Revisa el código y la configuración del experimento. Los detalles técnicos pueden aportar información adicional.",
        compilation:
          "El código no pudo compilarse correctamente. Revisa los errores del compilador antes de volver a ejecutar.",
        timeout:
          "La ejecución superó el tiempo máximo permitido. Revisa el algoritmo o utiliza una configuración de entrada menor.",
        results:
          "La ejecución terminó sin generar los resultados esperados. Revisa los detalles técnicos antes de intentar nuevamente.",
        server:
          "El servidor informó un problema durante la ejecución. Revisa los detalles técnicos y corrige el código o la configuración.",
      },
    },

    page: {
      headerTitle: "Nuevo análisis de rendimiento",
      headerSubtitle:
        "Sube una implementación y configura cómo Performance System evaluará su comportamiento.",
      configKicker: "Configuración",
      configTitle: "Prepara tu experimento",
      configDescription:
        "Selecciona el código, el tipo de benchmark y los parámetros de medición. Podrás revisar toda la configuración antes de iniciar la ejecución.",
      inputSize: {
        lines: "{{count}} líneas",
        values: "{{count}} valores",
      },
      recoveredExecution: "Ejecución recuperada",
      recoveredFiles: {
        one: "{{count}} archivo",
        other: "{{count}} archivos",
      },
      registeredEnvironment: "Entorno registrado",
      draft: {
        restored: "Se restauró tu configuración anterior.",
        clear: "Limpiar borrador",
      },
      repeat: {
        loaded:
          "Experimento #{{id}} cargado para repetición. Revisa la configuración antes de ejecutar.",
      },
      validations: {
        numberRequired: "Ingresa un valor numérico.",
        numberInvalid: "Ingresa un número válido.",
        minimum: "Mínimo permitido: {{min}}.",
        maximum: "Máximo permitido: {{max}}.",
      },
      alerts: {
        fileRequired: "Por favor, sube un archivo .zip antes de continuar.",
        benchmarkRequired: "Selecciona un tipo de test antes de ejecutar.",
        fileError: "Corrige el error del archivo antes de ejecutar.",
        parameterError:
          "Corrige los parámetros numéricos antes de ejecutar.",
        dataTypeRequired:
          "Selecciona el tipo de datos para CAMM antes de ejecutar.",
        courseLoading: "Espera mientras se carga tu contexto académico.",
        courseUnavailable:
          "No podemos iniciar la ejecución hasta verificar tus cursos activos.",
        courseRequired:
          "Selecciona el curso correspondiente antes de ejecutar.",
      },
      errors: {
        courses: "No fue posible consultar tus cursos activos.",
        coursesSession:
          "Tu sesión expiró. Inicia sesión nuevamente para consultar tus cursos.",
        coursesForbidden:
          "No tienes permiso para consultar tus cursos activos.",
        restoreInvalid:
          "No fue posible reconstruir la ejecución guardada.",
        restoreSession:
          "Tu sesión expiró. Inicia sesión nuevamente para recuperar la ejecución.",
        restoreForbidden:
          "No tienes permiso para recuperar esta ejecución.",
        restoreNotFound:
          "La ejecución indicada en la URL ya no existe.",
        restoreGeneric:
          "No fue posible recuperar la ejecución desde el servidor.",
        reuseInvalid:
          "No fue posible interpretar la configuración histórica.",
        reuseSession:
          "Tu sesión expiró. Inicia sesión nuevamente para reutilizar esta configuración.",
        reuseForbidden:
          "No tienes permiso para reutilizar esta ejecución.",
        reuseNotFound:
          "La ejecución usada como referencia ya no existe.",
        reuseGeneric:
          "No fue posible reutilizar la configuración histórica.",
        repeatInvalid:
          "El descriptor del Experimento histórico no es válido.",
        repeatSession:
          "Tu sesión expiró. Inicia sesión nuevamente para repetir el Experimento.",
        repeatForbidden:
          "Solo el propietario puede repetir este Experimento.",
        repeatUnavailable:
          "El ZIP histórico verificado no está disponible para repetir este Experimento.",
        repeatInconsistent:
          "Las ejecuciones históricas no comparten una configuración común. Puedes reutilizar una configuración individual.",
        repeatArchive:
          "El ZIP histórico no superó la validación requerida para un nuevo análisis.",
        repeatGeneric:
          "No fue posible cargar el Experimento para repetición.",
        submitNoExecutions:
          "El servidor registró la solicitud, pero no devolvió ejecuciones en cola.",
        submitNetwork:
          "No pudimos conectar con el servidor. Verifica que el backend esté disponible e inténtalo nuevamente.",
        submitSession:
          "Tu sesión expiró. Inicia sesión nuevamente antes de enviar el análisis.",
        submitForbidden:
          "Tu cuenta no tiene permisos para registrar este análisis.",
        submitTooLarge:
          "El archivo enviado supera el tamaño permitido por el servidor.",
        submitGeneric:
          "No fue posible registrar el análisis en el servidor. Inténtalo nuevamente.",
        resultsDestination:
          "No fue posible determinar el destino de resultados para esta ejecución.",
      },
    },
  },

  academicBreadcrumbs: {
    navigationAria: "Ruta de navegación",
    history: "Historial",
    administration: "Administración",
    users: "Usuarios",
    supervision: "Supervisión",
    course: "Curso",
    courseNumber: "Curso #{{id}}",
    profile: "Mi perfil",
    experiment: "Experimento",
    experimentNumber: "Experimento #{{id}}",
    result: "Resultado",
    comparison: "Comparación",
  },
  sourceViewer: {
    unavailable: "No disponible",
    fallbackSource: "Fuente histórica",
    fallbackDownloadFilename: "fuente.cpp",
    marker: "Fuente de esta ejecución",
    readOnly: "Vista histórica de solo lectura",
    closeAria: "Cerrar visor de código",
    size: "Tamaño",
    states: {
      loading: "Consultando la fuente histórica…",
    },
    errors: {
      network:
        "No pudimos conectar con el servidor para recuperar la fuente.",
      session:
        "Tu sesión no permite consultar esta fuente histórica.",
      notFound:
        "La fuente histórica no está disponible para esta ejecución.",
      integrity:
        "La fuente histórica no superó las comprobaciones de disponibilidad e integridad.",
      generic:
        "No fue posible recuperar la fuente histórica en este momento.",
      previewEncoding:
        "La vista previa no puede mostrarse porque la fuente histórica no utiliza codificación UTF-8 válida. Aún puedes descargar el archivo original.",
      forbidden:
        "Tu cuenta no tiene permiso para visualizar esta fuente.",
    },
    close: "Cerrar",
    download: {
      action: "Descargar .cpp",
      downloading: "Descargando…",
      success: "Fuente descargada correctamente.",
    },
  },

  submissionOverview: {
    fallbacks: {
      unavailable: "No disponible",
      noCourse: "Sin curso asociado",
      untitledExperiment: "Experimento sin título",
      unnamedFile: "Archivo sin nombre",
      notReported: "No informado",
      noData: "Sin datos",
    },
    labels: {
      period: "Período",
      originalArchive: "Archivo original",
      created: "Creado",
      course: "Curso",
      implementations: "Implementaciones",
      benchmark: "Benchmark",
      duration: "Duración",
      result: "Resultado",
      environment: "Entorno",
    },
    aggregateStates: {
      inProgress: "En progreso",
      completed: "Completado",
      partial: "Parcial",
      failed: "Error",
      cancelled: "Cancelado",
      empty: "Sin ejecuciones",
      unknown: "Desconocido",
    },
    executionStates: {
      queued: "En cola",
      running: "En ejecución",
      processing: "Procesando",
      completed: "Completado",
      failed: "Error",
      cancelled: "Cancelado",
      unknown: "Desconocido",
    },
    results: {
      available: "Disponible",
      pending: "Pendiente",
      unavailable: "No disponible",
    },
    states: {
      loadingTitle: "Cargando experimento",
      loadingDescription:
        "Consultando su metadata y el estado de las implementaciones.",
      errorTitle: "No fue posible cargar el experimento",
      errorDescription:
        "Revisa tu sesión o vuelve a intentar la consulta.",
      notFoundTitle: "Experimento no disponible",
      notFoundDescription:
        "No se encontró información para este experimento.",
      emptyTitle: "Sin ejecuciones",
      emptyDescription:
        "Este experimento todavía no registra implementaciones ejecutables.",
    },
    header: {
      experimentNumber: "Experimento #{{id}}",
    },
    information: {
      eyebrow: "Procedencia",
      title: "Información del experimento",
    },
    archive: {
      verifying: "Verificando archivo original…",
      downloading: "Descargando…",
      downloadAction: "Descargar ZIP original",
      unavailable: "Archivo original no disponible",
      verifyError:
        "No fue posible verificar la disponibilidad del archivo original.",
      downloadSuccess:
        "ZIP original descargado correctamente.",
      downloadError:
        "No fue posible descargar el ZIP original.",
      downloadNetwork:
        "No pudimos conectar para descargar el ZIP original.",
      downloadSession:
        "Tu sesión no permite descargar el ZIP original.",
    },
    personal: {
      eyebrow: "Solo tú",
      title: "Metadata personal",
      updating: "Actualizando…",
      reference: "Referencia",
      markReference: "Marcar como referencia",
      note: "Nota personal",
      characters: "{{count}}/{{max}} caracteres",
      saving: "Guardando…",
      noNote: "Sin nota personal",
    },
    feedback: {
      noteSaved: "Nota personal guardada.",
      pinned: "Experimento marcado como referencia.",
      unpinned: "Experimento removido de referencias.",
      shaCopied: "SHA copiado",
      shaCopyFailed: "No se pudo copiar",
    },
    errors: {
      noteSave:
        "No fue posible guardar la nota. Revisa el contenido y vuelve a intentarlo.",
      referenceUpdate:
        "No fue posible actualizar la referencia. Vuelve a intentarlo.",
    },
    summary: {
      eyebrow: "Estado agregado",
      title: "Resumen",
      executions: "Ejecuciones",
      completed: "Completadas",
      failed: "Con error",
      cancelled: "Canceladas",
    },
    implementations: {
      eyebrow: "Código fuente",
      title: "Implementaciones",
      description:
        "Cada archivo C++ conserva su propia ejecución y resultados independientes.",
      hierarchy:
        "Cada archivo .cpp del experimento genera una ejecución independiente y conserva sus propios resultados.",
    },
    reference: {
      regionAria: "Referencias compatibles para comparar",
      title: "Comparar con referencia",
      description: "Referencias experimentales para {{name}}.",
      loading: "Buscando referencias y evaluando compatibilidad…",
      empty:
        "No hay referencias disponibles. Marca un Experimento como Referencia para usarlo aquí.",
      compare: "Comparar",
      errors: {
        forbidden:
          "Las referencias personales solo están disponibles para el propietario.",
        load: "No fue posible cargar las referencias experimentales.",
      },
    },
    previous: {
      loading: "Buscando anterior…",
      none: "No existe una ejecución anterior compatible.",
      error:
        "No fue posible buscar la ejecución anterior compatible.",
    },
    comparison: {
      needTwo:
        "Se necesitan al menos dos implementaciones completadas con resultados.",
      regionAria:
        "Selección de implementaciones para comparar",
      title: "Selecciona implementaciones comparables",
      selectRange: "Selecciona entre 2 y 4 implementaciones.",
      preselected:
        "Las implementaciones elegibles están preseleccionadas. Puedes ajustar la selección antes de continuar.",
      maxFeedback:
        "Puedes comparar como máximo cuatro implementaciones. Deselecciona una para habilitar otro cupo.",
      compareSelected:
        "Comparar seleccionadas ({{count}})",
      selectFile: "Seleccionar {{name}}",
      notEligible: "No participa: {{reason}}",
      reasons: {
        failed: "La ejecución finalizó con error.",
        inProgress: "La ejecución todavía está en progreso.",
        notCompleted: "La ejecución todavía no está completada.",
        noResults: "La ejecución no tiene resultados disponibles.",
        invalidId: "La ejecución no tiene un identificador válido.",
      },
    },
    execution: {
      sourceMarker: "Fuente de esta ejecución",
      technicalId: "ID técnico",
      record: "Registro {{id}}",
      executionNumber: "Ejecución #{{id}}",
    },
    failure: {
      title:
        "La implementación no pudo completar el análisis.",
      noDetail:
        "El servidor no entregó más detalle del fallo.",
      stage: "Etapa",
      code: "Código",
    },
    actions: {
      retry: "Reintentar",
      copySha: "Copiar SHA-256 completo",
      cancel: "Cancelar",
      close: "Cerrar",
      save: "Guardar",
      edit: "Editar",
      refreshStates: "Actualizar estados",
      compareImplementations: "Comparar implementaciones",
      viewCode: "Ver código",
      reuseConfiguration: "Reutilizar configuración",
      repeatExperiment: "Repetir experimento",
      compareReference: "Comparar con referencia",
      comparePrevious: "Comparar con anterior compatible",
      viewResult: "Ver resultado",
    },
  },

  comparisonModel: {
    query: {
      count: "La URL debe incluir entre 2 y 4 implementaciones.",
      empty: "La URL contiene una implementación vacía.",
      duplicate: "Cada implementación debe aparecer una sola vez.",
    },
    historicalStatuses: {
      compatible: "Compatible",
      limited: "Con limitaciones",
      incompatible: "Incompatible",
      unavailable: "No disponible",
    },
    ineligibility: {
      failed: "La ejecución finalizó con error.",
      active: "La ejecución todavía está en progreso.",
      notCompleted: "La ejecución todavía no está completada.",
      noResults: "La ejecución no tiene resultados disponibles.",
      invalidId: "La ejecución no tiene un identificador válido.",
    },
    genericMetric: "Métrica",
    metrics: {
      DurationTime: {
        label: "Tiempo de ejecución",
        interpretation:
          "Valores menores representan menor tiempo de ejecución observado en los tamaños de entrada comparados.",
      },
      IPC: {
        label: "Instrucciones por ciclo (IPC)",
        interpretation:
          "Un IPC mayor describe más instrucciones retiradas por ciclo, pero no implica por sí solo un menor tiempo total.",
      },
      CacheMissRate: {
        label: "Tasa de fallos de caché",
        interpretation:
          "Una tasa menor indica menos fallos de caché observados; no demuestra por sí sola la causa del rendimiento.",
      },
      BranchMissRate: {
        label: "Tasa de fallos de predicción",
        interpretation:
          "Una tasa menor indica menos fallos de predicción observados; no constituye una explicación causal por sí sola.",
      },
      EnergyPkg: {
        label: "Energía del paquete CPU",
        interpretation:
          "Compare energía únicamente cuando está disponible para todas las implementaciones seleccionadas.",
      },
    },
    interpretations: {
      limited:
        "Esta comparación es válida únicamente dentro de las limitaciones mostradas.",
      incompatible:
        "La comparación fue bloqueada para evitar conclusiones experimentales no justificadas.",
      partialOverlap:
        "La comparación se limita a los tamaños de entrada medidos en común. No se interpola ni extrapola fuera de ese dominio.",
      singleInput:
        "Existe un único tamaño compartido; esta comparación no permite inferir una tendencia de escalamiento.",
      dispersion:
        "Si la dispersión es amplia respecto de las diferencias observadas, conviene interpretar diferencias pequeñas con cautela.",
    },
    dimensions: {
      benchmark: "Benchmark",
      hardware: "Hardware",
      measurementBackend: "Backend",
      profile: "Perfil",
      protocol: "Protocolo",
      compilerFlags: "Flags del compilador",
      sourceProvenance: "Procedencia",
      inputSizes: "Tamaños de entrada",
      metrics: "Métricas",
    },
    dimensionStatuses: {
      compatible: "Compatible",
      limited: "Con limitación",
      incompatible: "Incompatible",
      unavailable: "No disponible",
      unverifiable: "No verificable",
    },
    seriesFallback: "Implementación {{index}}",
    aggregation: {
      median: "Mediana",
      mean: "Media",
    },
    hover: {
      inputSize: "InputSize",
      stddev: "Desv. estándar",
      validSamples: "Muestras válidas",
      iqrOutliers: "Outliers IQR",
    },
    historicalDateUnavailable: "Fecha no disponible",
  },

  comparisonPage: {
    sectionNavigation: {
      aria: "Secciones de la comparación",
      implementations: "Implementaciones",
      summary: "Resumen",
      interpretation: "Interpretación",
      ai: "Asistencia IA",
      metrics: "Métricas",
      audit: "Auditoría",
    },
    ai: {
      eyebrow: "Complemento pedagógico",
      title: "Análisis comparativo asistido por IA",
      intro:
        "Complementa la lectura determinística con una síntesis estructurada de la evidencia comparativa canónica.",
      privacy:
        "El asistente no recibe código fuente del estudiante, CSV bruto ni métricas aportadas por el navegador como fuente científica.",
      loading:
        "Generando una síntesis desde la comparación canónica...",
      actions: {
        generate: "Generar análisis comparativo",
        update: "Actualizar análisis",
        loading: "Generando...",
      },
      status: {
        simulated:
          "Respuesta simulada · modo desarrollo",
        generated: "Respuesta generada por IA",
        cached: "Reutilizada desde caché",
        fresh: "Generada para esta comparación",
      },
      unavailable: {
        incompatible: {
          title:
            "IA no disponible para esta comparación",
          description:
            "La comparación es incompatible y no existe una base experimental válida para generar una síntesis comparativa.",
        },
        noEvidence: {
          title: "Sin evidencia común suficiente",
          description:
            "No hay métricas comparables comunes suficientes para generar una síntesis asistida.",
        },
      },
      sections: {
        summary: "Resumen",
        patterns: "Patrones observados",
        tradeoffs: "Compensaciones observadas",
        focus: "Qué conviene analizar",
        limitations: "Limitaciones",
      },
      empty: {
        summary: "No se informó un resumen adicional.",
        patterns: "No se informaron patrones adicionales.",
        tradeoffs:
          "No se identificaron compensaciones observadas con evidencia suficiente.",
        focus: "No se informaron focos adicionales.",
        limitations:
          "No se informaron limitaciones adicionales.",
      },
      providers: {
        mock: "Mock determinístico local",
        openai: "OpenAI",
        server: "Servidor",
      },
      meta: {
        provider: "Proveedor: {{provider}}",
        model: "Modelo: {{model}}",
        codeNotSent: "Código fuente enviado: no",
        csvNotSent: "CSV bruto enviado: no",
        browserMetricsNotTrusted:
          "Métricas del navegador usadas como fuente: no",
        canonicalComparison:
          "Comparación reconstruida canónicamente en servidor",
      },
      errors: {
        notConfigured:
          "El proveedor de IA no está configurado en el servidor.",
        outputRejected:
          "La respuesta generada no superó las validaciones científicas.",
        provider:
          "El proveedor de IA no está disponible temporalmente.",
        invalidLanguage:
          "El idioma solicitado no está soportado.",
        unavailable:
          "Esta comparación no posee base experimental suficiente para IA.",
        unauthorized:
          "Tu sesión ya no permite generar este análisis.",
        forbidden:
          "No tienes permisos para analizar una o más de estas ejecuciones.",
        network:
          "No pudimos conectar con el servidor.",
        generic:
          "No fue posible generar el análisis comparativo asistido.",
      },
    },
    actions: {
      back: "Volver",
      retry: "Reintentar",
      remove: "Quitar",
      add: "Agregar",
    },
    common: {
      profile: "Perfil",
      compilerFlags: "Flags del compilador",
      notVerifiable: "No verificable",
    },
    status: {
      compatible: {
        label: "Compatible",
        text:
          "Las ejecuciones cumplen el contrato de compatibilidad para las mediciones comunes mostradas.",
      },
      limitedCoverage: {
        label: "Comparación válida · cobertura parcial",
        text:
          "Las condiciones experimentales comparables se mantienen; una o más métricas objetivo no están disponibles de forma común.",
      },
      limited: {
        label: "Comparación con alcance limitado",
        text:
          "Existen advertencias experimentales fuera de la cobertura métrica; interpreta únicamente el dominio y las condiciones comunes indicadas.",
      },
      incompatible: {
        label: "Comparación incompatible",
        text:
          "Estas ejecuciones no cumplen el contrato necesario para superponer sus resultados de rendimiento.",
      },
    },
    requestErrors: {
      network: {
        title: "Sin conexión con el servidor",
        description: "No pudimos conectar con el servidor.",
      },
      unauthorized: {
        title: "Sesión no disponible",
        description:
          "Tu sesión ya no permite consultar esta comparación.",
      },
      forbidden: {
        title: "Comparación restringida",
        description:
          "No tienes permisos para comparar una o más de estas ejecuciones.",
      },
      notFound: {
        title: "Resultados no disponibles",
        description:
          "Una de las ejecuciones o sus resultados ya no está disponible.",
      },
      notReady: {
        title: "Resultados todavía no publicables",
        description:
          "Una de las ejecuciones todavía no tiene resultados publicables.",
      },
      notComparable: {
        title: "Resultados no comparables",
        description:
          "Los resultados no cumplen el contrato necesario para compararlos.",
      },
      generic: {
        title: "No fue posible cargar la comparación",
        description: "No fue posible cargar la comparación.",
      },
    },
    candidateErrors: {
      network: {
        title: "Sin conexión con el servidor",
        description: "No pudimos conectar con el servidor.",
      },
      forbidden: {
        title: "Historial no disponible",
        description:
          "Tu sesión no permite consultar ejecuciones históricas para esta selección.",
      },
      generic: {
        title: "No fue posible cargar el historial",
        description:
          "No fue posible cargar las ejecuciones históricas.",
      },
    },
    context: {
      experiment: "Experimento",
      experimentNumber: "Experimento #{{id}}",
      backExperiment: "Volver al experimento",
      differentExperiments:
        "Ejecuciones de distintos experimentos",
    },
    states: {
      invalid: {
        title: "Comparación no válida",
      },
      loading: {
        title: "Cargando comparación",
        description:
          "Estamos reuniendo los resultados estructurados de las implementaciones seleccionadas.",
      },
    },
    header: {
      eyebrow: "Análisis comparativo",
      title: "Comparación de implementaciones",
      selectionCount: {
        one: "{{count}} implementación seleccionada",
        other: "{{count}} implementaciones seleccionadas",
      },
    },
    implementations: {
      eyebrow: "Series",
      title: "Implementaciones",
      maxFour: "Máximo 4 implementaciones",
      closeHistory: "Cerrar historial",
      addHistorical: "Agregar ejecución histórica",
      removeAria: "Quitar {{name}}",
    },
    history: {
      eyebrow: "Historial accesible",
      title: "Ejecuciones históricas",
      description:
        "Cada opción se evalúa junto a toda la selección actual antes de poder agregarla.",
      showIncompatible: "Mostrar incompatibles",
      loading: {
        title: "Buscando ejecuciones históricas",
        description:
          "Estamos verificando compatibilidad y permisos para la selección actual.",
      },
      empty: {
        title: "Sin ejecuciones compatibles",
        description:
          "No encontramos ejecuciones históricas compatibles con la selección actual.",
      },
      candidateFallback: "Implementación histórica {{index}}",
      date: "Fecha",
      alreadySelected: "Ya seleccionada",
      cannotAdd: "No se puede agregar",
      truncated:
        "Se muestran las ejecuciones recientes disponibles dentro del límite de búsqueda.",
    },
    summary: {
      eyebrow: "Vista comparativa",
      title: "Resumen comparativo",
      description:
        "Las mini curvas muestran las medianas ya reportadas sobre el dominio común de cada métrica objetivo. Los valores corresponden al mayor InputSize común disponible.",
      availability:
        "{{available}} de {{total}} métricas objetivo comparables",
      coverageLabel: "métricas objetivo comparables",
      inputSize: "InputSize {{inputSize}}",
      reportedMedian: "Mediana reportada",
      trendAria: "Tendencia comparativa de {{metric}}",
      unavailableBadge: "No comparable",
      unavailableDescription:
        "No existe una serie común válida para todas las implementaciones seleccionadas.",
      noRanking:
        "El resumen presenta evidencia por métrica. No calcula un ganador ni un puntaje global.",
      empty: {
        title: "Sin métricas objetivo comparables",
        description:
          "No hay métricas objetivo con una mediana común verificable para resumir.",
      },
    },
    audit: {
      eyebrow: "Validez experimental",
      title: "Auditoría de comparabilidad",
      description:
        "Revisa benchmark, hardware, backend, perfil, protocolo, flags, procedencia, dominio de entrada y cobertura de métricas.",
      show: "Mostrar detalle",
      hide: "Ocultar detalle",
    },
    auditDetails: {
      summaryAria:
        "Resumen de la auditoría de comparabilidad",
      summary: {
        dimensions: "Dimensiones",
        blockers: "Bloqueos",
        warnings: "Advertencias",
        excluded: "Métricas excluidas",
      },
      noAdditionalFindings:
        "No se registran bloqueos, advertencias adicionales ni métricas excluidas.",
      unknownIssue:
        "Se registró una observación de comparabilidad ({{code}}).",
      unknownExclusion:
        "La métrica fue excluida de la comparación común ({{code}}).",
      issueMessages: {
        BENCHMARK_UNVERIFIED:
          "No fue posible verificar el benchmark de todas las ejecuciones.",
        BENCHMARK_MISMATCH:
          "Las ejecuciones usan benchmarks diferentes.",
        HARDWARE_UNVERIFIED:
          "No fue posible verificar el hardware observado de todas las ejecuciones.",
        HARDWARE_MISMATCH:
          "Las ejecuciones fueron medidas en hardware observado diferente.",
        MEASUREMENT_BACKEND_UNVERIFIED:
          "No fue posible verificar el backend de medición.",
        MEASUREMENT_BACKEND_MISMATCH:
          "Las ejecuciones usan backends de medición diferentes.",
        MEASUREMENT_BACKEND_VERSION_UNVERIFIED:
          "No fue posible verificar la versión del backend en todas las ejecuciones.",
        MEASUREMENT_BACKEND_VERSION_DIFFERS:
          "Las versiones observadas del backend de medición son diferentes.",
        PROFILE_UNVERIFIED:
          "No fue posible verificar el perfil de ejecución.",
        PROFILE_MISMATCH:
          "Las ejecuciones usan perfiles diferentes.",
        PROTOCOL_UNVERIFIED:
          "No fue posible verificar el protocolo completo de medición.",
        PROTOCOL_MISMATCH:
          "Las ejecuciones usan protocolos de medición diferentes.",
        COMPILER_FLAGS_UNVERIFIED:
          "No fue posible verificar los flags del compilador.",
        COMPILER_FLAGS_MISMATCH:
          "Las ejecuciones usan flags del compilador diferentes.",
        AMBIGUOUS_RESULT_PROVENANCE:
          "Una ejecución contiene resultados asociados a múltiples fuentes.",
        DURATION_UNAVAILABLE:
          "El tiempo de ejecución no está disponible de forma comparable.",
        NO_COMMON_INPUT_SIZE:
          "Las ejecuciones no comparten ningún InputSize medido.",
        PARTIAL_INPUT_OVERLAP:
          "Las ejecuciones sólo comparten una parte del dominio de InputSize medido.",
        SINGLE_COMMON_INPUT_SIZE:
          "La comparación dispone de un único InputSize común.",
        TARGET_METRIC_UNAVAILABLE:
          "La métrica objetivo no está disponible de forma comparable en todas las ejecuciones.",
        METRIC_UNIT_MISMATCH:
          "La unidad reportada para la métrica objetivo no coincide entre ejecuciones.",
        METRIC_PARTIAL_COVERAGE:
          "La métrica sólo cubre parte de los InputSize comunes.",
      },
      excludedReasons: {
        TARGET_METRIC_UNAVAILABLE:
          "No está disponible de forma común en todas las ejecuciones.",
        METRIC_UNIT_MISMATCH:
          "Se excluyó porque la unidad reportada no coincide entre ejecuciones.",
        DURATION_UNAVAILABLE:
          "No puede construirse como métrica común porque el tiempo de ejecución no está disponible de forma comparable.",
        NO_COMMON_INPUT_SIZE:
          "No puede construirse sobre un InputSize medido en común.",
      },
    },
    dimensions: {
      eyebrow: "Contrato científico",
      title: "Compatibilidad por dimensión",
    },
    observations: {
      eyebrow: "Alcance",
      title: "Observaciones",
      blocker: "Bloqueo de compatibilidad",
      blockerFallback: "Dimensión incompatible.",
      limitation: "Limitación",
      warningFallback:
        "Comparación con alcance limitado.",
    },
    excluded: {
      eyebrow: "Cobertura",
      title: "Métricas no comparables",
      fallback:
        "No está disponible de forma común.",
    },
    pedagogy: {
      eyebrow: "Interpretación determinística",
      title: "Lectura comparativa de la evidencia",
      description:
        "Resume lo observado en las métricas objetivo comparables a partir de agregados ya reportados.",
      deterministic: "Reglas determinísticas",
      metric: "Métrica",
      whatItRepresents: "Qué representa",
      whatWasObserved: "Qué ocurrió en esta comparación",
      observedAt: "Medianas reportadas en InputSize {{inputSize}}",
      details: "Evidencia y contexto",
      detailsHint: "{{count}} apartados",
      show: "Ver detalle",
      hide: "Ocultar detalle",
      trend: "Tendencia observada",
      variability: "Variabilidad",
      limitations: "Limitaciones",
      noTrend:
        "Sólo existe un InputSize común para esta métrica; no se describe una tendencia de escalamiento.",
      trendLine:
        "Entre InputSize {{firstInput}} y {{lastInput}}, la mediana {{direction}} de {{firstValue}} a {{lastValue}}.",
      directions: {
        increased: "aumentó",
        decreased: "disminuyó",
        unchanged: "se mantuvo sin cambio",
        unavailable: "no pudo describirse",
      },
      variabilityLine:
        "En InputSize {{inputSize}}: Q1–Q3 {{q1}}–{{q3}} · σ {{stddev}}.",
      variabilityUnavailable:
        "No existe dispersión numérica comparable reportada para este punto.",
      partialMetricCoverage:
        "Esta métrica cubre {{metricCount}} de {{scopeCount}} InputSize comunes.",
      metricWarnings:
        "La auditoría registra {{count}} advertencia específica para esta métrica.",
      scopeTitle: "Alcance de esta lectura",
      scopeText:
        "La comparación contiene advertencias o métricas objetivo excluidas. Esta interpretación utiliza sólo el dominio y la evidencia comparable; el detalle técnico permanece en la auditoría.",
      excludedMetrics:
        "Métricas objetivo no comparables: {{metrics}}.",
      principle:
        "Esta lectura describe evidencia observada. No asigna un ganador global, no establece causalidad y no clasifica complejidad asintótica.",
      implementation: "Implementación {{index}}",
    },
    guidance: {
      eyebrow: "Lectura prudente",
      title: "Cómo interpretar esta comparación",
    },
    explorer: {
      categoriesAria: "Categorías de métricas comparativas",
      categories: {
        primary: "Principales",
        performance: "Rendimiento",
        cache: "Caché",
        cpu: "CPU",
        system: "Sistema",
        energy: "Energía",
        other: "Otras",
      },
      metricEyebrow: "Comparación por métrica",
      plotAria: "Gráfico comparativo de {{metric}}",
      noPoints: "No hay puntos visibles con el rango actual.",
      detailInspector: "Inspector detallado de una métrica",
      detailInspectorHint: "Una métrica a la vez · vista avanzada",
      empty: {
        title: "Sin métricas en esta categoría",
        description:
          "No hay métricas comunes disponibles para las implementaciones seleccionadas en esta categoría.",
      },
    },
    filters: {
      eyebrow: "Visualización",
      title: "Filtros comparativos",
      description:
        "Se aplican a todos los gráficos de esta sección y no modifican las mediciones reportadas.",
      activeCount: "Filtros activos: {{count}}",
      reset: "Restablecer filtros",
      aggregation: "Agregación",
      median: "Mediana",
      mean: "Media",
      aggregationHelp:
        "Selecciona el estadístico central ya reportado; no se recalculan muestras.",
      dispersion: "Dispersión",
      showDispersion: "Mostrar dispersión",
      dispersionMedianHelp:
        "Con mediana, las barras representan Q1–Q3 cuando esos valores están disponibles.",
      dispersionMeanHelp:
        "Con media, las barras representan desviación estándar cuando está disponible.",
      horizontalScale: "Escala horizontal",
      linear: "Lineal",
      logarithmic: "Logarítmica",
      horizontalScaleHelp:
        "Sólo cambia la representación del eje X; los valores medidos no se transforman.",
      logUnavailable:
        "La escala logarítmica requiere InputSize estrictamente positivos.",
      inputRange: "Rango de InputSize",
      rangeHelp:
        "Limita los puntos visibles dentro del dominio común; no interpola ni extrapola.",
    },
    chart: {
      eyebrow: "Mediciones comunes",
      title: "Resultados superpuestos",
      noMetrics: {
        title: "Sin métricas comparables",
        description:
          "La respuesta no contiene una métrica común disponible para graficar.",
      },
      metric: "Métrica",
      aggregation: "Agregación",
      showDispersion: "Mostrar dispersión",
      rangeAria: "Rango de InputSize",
      minimumInputSize: "InputSize mínimo",
      maximumInputSize: "InputSize máximo",
      resetRange: "Restablecer rango",
      medianLower: "mediana",
      meanLower: "media",
      axisContext:
        "Eje X: InputSize. Eje Y: {{aggregation}}{{unit}}.",
      dispersionIqr: " Dispersión Q1–Q3.",
      dispersionStddev:
        " Dispersión mediante desviación estándar.",
      dispersionHidden: " Dispersión oculta.",
      noPoints: {
        title: "Sin puntos para este rango",
        description:
          "No hay valores centrales disponibles en el rango seleccionado.",
      },
      plotAria: "Gráfico comparativo de {{metric}}",
    },
  },

  reproducibilityPanel: {
    common: {
      unavailable: "No disponible",
      yes: "Sí",
      no: "No",
    },
    availability: {
      available: "Disponible",
      unavailable: "No disponible",
    },
    integrity: {
      verified: "Verificado",
      unavailable: "No disponible",
      unverified: "Sin verificar",
      mismatch: "No coincide",
      invalidReference: "Referencia inválida",
      invalidArchive: "ZIP inválido",
    },
    resources: {
      manifest: "el manifest",
      provenance: "la procedencia",
      source: "la fuente",
      manifestJson: "el manifest JSON",
      csv: "el CSV",
      bundle: "el paquete reproducible",
    },
    requestErrors: {
      network: "No fue posible conectar para cargar {{resource}}.",
      forbidden: "Tu sesión no permite consultar {{resource}}.",
      notFound: "{{resource}} no está disponible para esta ejecución.",
      generic: "No fue posible cargar {{resource}}.",
    },
    downloadErrors: {
      network: "No pudimos conectar para descargar {{resource}}.",
      forbidden: "Tu sesión no permite descargar {{resource}}.",
      notFound: "{{resource}} no está disponible para esta ejecución.",
      generic: "No fue posible descargar {{resource}}.",
    },
    download: {
      success: "{{resource}} se descargó correctamente.",
    },
    header: {
      eyebrow: "Identidad experimental",
      title: "Reproducibilidad y trazabilidad experimental",
      description:
        "Código, hardware, configuración y artefactos verificables.",
    },
    disclosure: {
      expand: "Mostrar detalles",
      collapse: "Ocultar detalles",
    },
    loading: "Cargando identidad reproducible…",
    partial: {
      scientificResultsRemain:
        "Los resultados científicos permanecen disponibles.",
    },
    source: {
      title: "Fuente de esta ejecución",
    },
    executionStates: {
      queued: "En cola",
      running: "En ejecución",
      processing: "Procesando",
      completed: "Completada",
      failed: "Error",
      cancelled: "Cancelada",
    },
    fields: {
      technicalId: "ID técnico",
      state: "Estado",
      created: "Creada",
      finished: "Finalizada",
      size: "Tamaño",
      profile: "Perfil",
      inputSize: "Tamaño de entrada",
      samples: "Muestras",
      compilerFlags: "Flags del compilador",
      points: "Puntos",
      samplesPerPoint: "Muestras por punto",
      warmupRounds: "Rondas de calentamiento",
      perfScope: "Ámbito perf",
      eventFallback: "Fallback por evento",
      cpuVendor: "Fabricante CPU",
      cpuModel: "Modelo CPU",
      architecture: "Arquitectura",
      logicalCpus: "CPU lógicas",
      backend: "Backend",
      version: "Versión",
      requestedScope: "Ámbito solicitado",
    },
    copy: {
      idAction: "Copiar ID",
      linkAction: "Copiar enlace",
      publicIdSuccess: "Public ID copiado",
      linkSuccess: "Enlace copiado",
      error: "No se pudo copiar",
    },
    configuration: {
      title: "Configuración",
    },
    hardware: {
      title: "Hardware observado durante la ejecución",
      note: "No representa el perfil solicitado.",
    },
    artifacts: {
      source: "Fuente",
      measurements: "Mediciones",
      originalArchive: "Archivo original",
    },
    actions: {
      aria: "Acciones de reproducibilidad",
      viewCode: "Ver código",
      downloading: "Descargando…",
      downloadSource: "Descargar fuente .cpp",
      downloadManifest: "Descargar manifest JSON",
      downloadCsv: "Descargar CSV",
      downloadBundle: "Descargar paquete reproducible",
    },
  },

  renderImage: {
    sectionNavigation: {
      aria: "Secciones del resultado",
      summary: "Resumen",
      interpretation: "Interpretación",
      metrics: "Métricas",
      reproducibility: "Reproducibilidad",
    },
    executionFallback: "Ejecución {{codename}}",
    common: {
      back: "Volver",
      retry: "Reintentar",
      range: "rango {{min}}–{{max}}",
    },
    loading: {
      title: "Cargando resultados",
      description: "Preparando el dashboard de la ejecución.",
    },
    errors: {
      titles: {
        network: "No pudimos conectar con el servidor",
        forbidden: "No puedes abrir esta ejecución",
        notFound: "Ejecución no encontrada",
        unavailable: "Resultado todavía no disponible",
        generic: "No pudimos abrir esta ejecución",
      },
      descriptions: {
        network:
          "No pudimos comunicarnos con el servidor. Verifica que el backend esté disponible e inténtalo nuevamente.",
        forbidden:
          "Esta ejecución existe, pero tu cuenta no tiene permisos para consultar sus resultados.",
        notFound:
          "La ejecución o alguno de sus artefactos de resultados ya no está disponible.",
        unavailable:
          "La ejecución todavía no tiene resultados listos para visualizar.",
        session:
          "Tu sesión ya no permite consultar esta ejecución. Vuelve a iniciar sesión.",
        generic:
          "No fue posible cargar los resultados de esta ejecución.",
      },
    },
    download: {
      action: "Descargar CSV",
      downloading: "Descargando...",
      success: "CSV descargado correctamente.",
      errors: {
        generic: "No fue posible descargar el CSV en este momento.",
        network:
          "No pudimos conectar con el servidor para descargar el CSV.",
        forbidden:
          "Tu cuenta no tiene permisos para descargar este CSV.",
        notFound:
          "El CSV de esta ejecución ya no está disponible.",
      },
    },
    header: {
      viewExperiment: "Ver experimento",
      analysisCompleted: "Análisis completado",
      eyebrow: "Resultados de rendimiento",
      description:
        "Explora cómo cambia el comportamiento del programa a medida que aumenta el tamaño de entrada.",
    },
    categories: {
      aria: "Categorías de métricas",
      summary: "Resumen",
      performance: "Rendimiento",
      cache: "Caché",
      cpu: "CPU",
      system: "Sistema",
      energy: "Energía",
    },
    toolbar: {
      filters: "Filtros",
      advancedMetrics: "Métricas avanzadas",
    },
    summary: {
      eyebrow: "Vista principal",
      title: "Métricas clave",
      description:
        "Estas métricas ofrecen una primera lectura del tiempo, trabajo de CPU, memoria y flujo de control.",
      missingPrimary: {
        one: "{{count}} métrica principal no está disponible en esta ejecución.",
        other:
          "{{count}} métricas principales no están disponibles en esta ejecución.",
      },
    },
    empty: {
      title: "No hay métricas disponibles en esta categoría",
      description:
        "Esta ejecución no generó gráficos para las métricas seleccionadas.",
    },
    footer: {
      note:
        "Las métricas disponibles se renderizan desde la API JSON. Cuando una medición no está disponible, el dashboard comunica su causa explícitamente en lugar de dibujar un gráfico vacío o asumir un valor cero.",
    },
    filters: {
      eyebrow: "Visualización",
      title: "Filtros del análisis",
      description:
        "Cambian únicamente la representación de los resultados; no modifican las mediciones originales.",
      reset: "Restablecer",
      aggregation: "Agregación",
      mean: "Media",
      median: "Mediana",
      aggregationHelp:
        "Define el valor central mostrado en gráficos y KPIs.",
      dispersion: "Dispersión",
      iqrInterval: "Intervalo Q1–Q3",
      stddevInterval: "± desviación estándar",
      iqrHelp:
        "Muestra el 50 % central de las observaciones alrededor de la mediana.",
      stddevHelp:
        "Muestra la desviación estándar muestral alrededor de la media.",
      horizontalScale: "Escala horizontal",
      linear: "Lineal",
      horizontalScaleHelp:
        "Afecta solo al eje de tamaño de entrada.",
      inputRange: "Rango de entrada",
      from: "Desde",
      to: "Hasta",
      minimum: "Mínimo",
      maximum: "Máximo",
      rangeHelp: "Limita los puntos visibles sin alterar el CSV.",
      singleInputHelp:
        "Esta ejecución contiene un único tamaño de entrada.",
    },
    kpiOverview: {
      eyebrow: "Lectura rápida",
      title: "Indicadores principales",
      description:
        "Valor de {{aggregation}} en el mayor tamaño de entrada visible{{range}}.",
      availabilitySummary:
        "{{available}} de {{total}} indicadores principales disponibles.",
    },
    kpis: {
      DurationTime: {
        label: "Tiempo",
        description: "Tiempo de ejecución",
      },
      IPC: {
        label: "IPC",
        description: "Instrucciones por ciclo",
      },
      CacheMissRate: {
        label: "Cache miss",
        description: "Tasa de fallos de caché",
      },
      BranchMissRate: {
        label: "Branch miss",
        description: "Fallos de predicción",
      },
      Instructions: {
        label: "Instrucciones",
        description: "Trabajo ejecutado por CPU",
      },
    },
    kpiCard: {
      inputSize: "Tamaño {{inputSize}}",
      unavailable: "No disponible",
      noValidData:
        "No se obtuvieron datos válidos para este indicador.",
      validSamples: "{{valid}}/{{total}} muestras válidas",
      implementations: {
        one: "{{count}} implementación",
        other: "{{count}} implementaciones",
      },
    },
    metadata: {
      benchmark: "Benchmark",
      benchmarkDescription: "Tipo de prueba ejecutada",
      maxSize: "Tamaño máximo",
      maxSizeDescription: "Límite de entrada configurado",
      repetitions: "Repeticiones",
      repetitionsDescription: "Por punto de medición",
      environment: "Entorno",
      managed: "Administrado",
      environmentDescription:
        "Nodo configurado por Performance System",
      course: "Curso",
      noCourse: "Sin curso asociado",
      period: "Período",
      personalAnalysis: "Análisis personal",
      tasks: {
        lcs: "Entrada de texto",
        numeric: "Datos numéricos",
        size: "Tamaño parametrizado",
      },
    },
  },

  renderImageScientific: {
    metricCard: {
      genericMetric: "Métrica",
      genericDescription:
        "Esta métrica no tiene una descripción pedagógica configurada todavía.",
      explainAria: "Explicar {{metric}}",
      represents: "Qué representa",
      legacyCompatibility: "Compatibilidad legacy",
      noVisualizationData: "Sin datos de visualización",
    },
    chart: {
      executionSeries: "Ejecución",
      inputSize: "Tamaño de entrada",
      mean: "Media",
      median: "Mediana",
      stddev: "Desv. estándar",
      numericSamples: "Muestras numéricas",
      iqrOutliers: "Outliers IQR detectados",
      legacyFrameTitle: "Gráfico de {{title}}",
    },
    pedagogy: {
      eyebrow: "Interpretación guiada",
      title: "Qué muestran los resultados",
      deterministic: "Basada en reglas reproducibles",
      disclaimer:
        "Estas conclusiones describen únicamente las mediciones de esta ejecución. No califican por sí solas un algoritmo como bueno, malo, eficiente o ineficiente.",
      whatItRepresents: "Qué representa",
      metricHeading: "Qué ocurrió en esta ejecución",
      evidenceDisclosure: {
        count: "{{count}} evidencias disponibles",
        show: "Mostrar",
        hide: "Ocultar",
      },
      meaningFallback:
        "Métrica experimental observada durante la ejecución.",
      kinds: {
        snapshot: "Valor observado",
        trend: "Tendencia observada",
        observedScaling: "Escalamiento observado",
        outliers: "Variabilidad",
        coverage: "Cobertura",
        limitation: "Alcance",
        availability: "Disponibilidad",
        analysis: "Análisis",
      },
      messages: {
        snapshot: {
          base:
            "{{metric}}: en el mayor tamaño de entrada medido ({{inputSize}}), la mediana fue {{median}}.",
          iqr: "El intervalo Q1–Q3 fue de {{q1}} a {{q3}}.",
          mean: "Como referencia complementaria, la media fue {{mean}}.",
          stddev: "La desviación estándar fue {{stddev}}.",
          cv: "El coeficiente de variación clásico fue {{cv}}.",
        },
        trend: {
          base:
            "Entre los tamaños de entrada {{firstInput}} y {{lastInput}}, {{metric}} pasó de {{firstValue}} a {{lastValue}}.",
          increase: "Se observó un aumento relativo de {{change}}.",
          decrease: "Se observó una disminución relativa de {{change}}.",
          noChange: "No se observó cambio relativo.",
          pairwise:
            "En {{comparisons}} intervalos consecutivos: {{increasing}} aumentos, {{decreasing}} disminuciones y {{unchanged}} sin cambio apreciable.",
        },
        observedScaling:
          "En la escala log-log observada sobre las medianas, {{metric}} presentó un exponente empírico de {{exponent}} con R²={{rSquared}}. Describe únicamente los puntos medidos y no constituye una clasificación de complejidad asintótica.",
        outliers: {
          detected:
            "El criterio IQR 1,5× detectó {{detected}} de {{evaluated}} muestras evaluadas ({{rate}}) como potencialmente atípicas. Las observaciones se conservaron en los agregados.",
          groups:
            "El diagnóstico se aplicó en {{diagnostic}} de {{total}} puntos de entrada.",
          insufficient:
            "El criterio IQR no se aplicó como diagnóstico porque los puntos disponibles no alcanzaron el mínimo de muestras requerido. No se eliminó ninguna muestra.",
        },
        singleInputLimitation:
          "Esta ejecución contiene un único tamaño de entrada para esta métrica, por lo que no es posible describir una tendencia respecto del tamaño de entrada.",
        partialCoverage:
          "{{numeric}} de {{total}} filas de medición contienen un valor numérico para esta métrica.",
        availability: {
          permissionDenied:
            "Esta métrica no fue medida porque el proceso de medición no tuvo permisos suficientes para acceder al evento de rendimiento solicitado. La ausencia de medición no se interpreta como cero.",
          unsupported:
            "Esta métrica no fue medida porque el evento de hardware no está soportado por el entorno observado. La ausencia de medición no se interpreta como cero.",
          notCounted:
            "El evento fue reconocido, pero no se obtuvo un conteo válido durante esta ejecución. La ausencia de medición no se interpreta como cero.",
          noNumeric:
            "No se obtuvieron observaciones numéricas válidas para esta métrica. La ausencia de medición no se interpreta como cero.",
        },
        fallback:
          "La evidencia estructurada de esta observación no puede presentarse con la versión actual de la interfaz.",
      },
    },
    ai: {
      eyebrow: "Complemento pedagógico",
      title: "Análisis asistido por IA",
      intro:
        "Este módulo complementa la interpretación determinística con una lectura estructurada de la evidencia disponible.",
      privacy:
        "El asistente no recibe el código fuente del estudiante ni el CSV bruto.",
      actions: {
        generate: "Generar análisis con IA",
        update: "Actualizar análisis",
        loading: "Generando...",
      },
      status: {
        simulated:
          "Respuesta simulada · modo desarrollo",
        generated:
          "Respuesta generada con IA",
        cached:
          "Reutilizada desde caché",
        fresh:
          "Generada para esta ejecución",
      },
      sections: {
        summary: "Resumen",
        patterns: "Patrones observados",
        observe: "Qué conviene observar",
        limitations: "Limitaciones",
      },
      emptyPatterns:
        "El asistente no informó patrones adicionales para esta ejecución.",
      emptyLimitations:
        "El asistente no informó limitaciones adicionales.",
      providers: {
        mock: "Mock local",
        openai: "OpenAI",
        server: "Configurado por servidor",
      },
      meta: {
        provider: "Proveedor: {{provider}}",
        model: "Modelo: {{model}}",
        codeNotSent: "Código fuente enviado: no",
        csvNotSent: "CSV bruto enviado: no",
      },
      metrics: {
        DurationTime: "Tiempo de ejecución",
        IPC: "IPC",
        CacheMissRate: "Tasa de fallos de caché",
        BranchMissRate: "Tasa de fallos de predicción",
        Instructions: "Instrucciones",
        L1DcacheLoadMisses: "Fallos de lectura L1D",
      },
      evidenceKinds: {
        snapshot: "Valor observado",
        trend: "Tendencia observada",
        observedScaling: "Escalamiento observado",
        outliers: "Variabilidad",
        coverage: "Cobertura",
        limitation: "Limitación",
        availability: "Disponibilidad",
      },
      errors: {
        notConfigured:
          "La IA real no está configurada en el servidor. La interpretación determinística sigue disponible.",
        outputRejected:
          "La respuesta fue descartada porque no superó las validaciones de consistencia.",
        provider:
          "El proveedor de IA no está disponible temporalmente.",
        invalidLanguage:
          "El idioma solicitado para el análisis asistido no está soportado.",
        generic:
          "No fue posible generar el análisis asistido en este momento.",
      },
    },
    availability: {
      partial:
        "Disponibilidad parcial: {{numeric}} de {{total}} muestras contienen un valor numérico.",
      measurementContext: "Contexto de medición",
      notZero:
        "La ausencia de una medición no se interpreta como un valor cero.",
      metricUnavailableTitle: "{{title}} no disponible",
      metricUnavailableDescription:
        "No hay datos estructurados ni una visualización legacy para esta métrica.",
      statuses: {
        permissionDenied: {
          label: "Permiso insuficiente",
          description:
            "El proceso de medición no tuvo permisos suficientes para acceder al evento de rendimiento solicitado.",
        },
        unsupported: {
          label: "No disponible",
          description:
            "La medición no produjo muestras numéricas válidas en el entorno utilizado para esta ejecución.",
        },
        notCounted: {
          label: "No contabilizada",
          description:
            "El evento fue reconocido, pero perf no pudo obtener un conteo válido durante esta ejecución.",
        },
        noData: {
          label: "Sin datos válidos",
          description:
            "No se obtuvieron observaciones numéricas suficientes para representar esta métrica.",
        },
        default: {
          label: "No disponible",
          description:
            "Esta métrica no dispone de datos representables en la ejecución actual.",
        },
      },
      summary: {
        permissionDenied:
          "{{total}}/{{total}} muestras no pudieron acceder al evento por permisos insuficientes del proceso de medición.",
        permissionDeniedRows:
          "{{count}}/{{total}} muestras no pudieron acceder al evento por permisos insuficientes.",
        eventNotExposed:
          "{{total}}/{{total}} muestras no dispusieron de este evento en el backend de medición.",
        notSupported:
          "{{total}}/{{total}} muestras no pudieron medir este evento en el entorno observado.",
        notCounted:
          "{{total}}/{{total}} muestras no produjeron un conteo válido para este evento.",
        backendError:
          "No fue posible verificar la disponibilidad del evento para las {{total}} muestras por un problema del backend de medición.",
        noNumericSample:
          "{{total}}/{{total}} muestras quedaron sin una observación numérica válida para este evento.",
        unsupported:
          "{{count}}/{{total}} muestras reportaron el evento como no disponible.",
        notCountedRows:
          "{{count}}/{{total}} muestras no pudieron ser contabilizadas.",
        noData:
          "{{count}}/{{total}} muestras sin un valor numérico válido.",
      },
      provenance: {
        metric_availability_sidecar: "procedencia preservada",
        raw_csv_fallback: "procedencia recuperada",
      },
    },
    hardware: {
      requestedEvent: "el evento solicitado",
      permissionDenied:
        "El evento {{event}} no pudo medirse porque el proceso de medición no tiene permisos suficientes para accederlo.",
      eventNotExposed:
        "El backend perf de este entorno no expone {{event}}.",
      notSupported:
        "El evento {{event}} aparece expuesto por perf, pero la prueba de disponibilidad no pudo medirlo en este entorno.",
      notCounted:
        "El evento {{event}} fue reconocido, pero la prueba de disponibilidad no produjo un conteo válido.",
      backendError:
        "No fue posible verificar {{event}} por un problema del backend de medición.",
      noNumericSample:
        "La prueba de {{event}} no produjo una muestra numérica válida.",
      numeric:
        "La prueba de {{event}} produjo una muestra numérica válida.",
      notExposedGeneric:
        "El backend de medición no expone {{event}} en este entorno.",
      requestedScope: "scope solicitado: {{scope}}",
      observedEnvironment: "Entorno observado: {{details}}.",
    },
    footer: {
      apiData: "Datos API",
      median: "mediana",
      mean: "media",
      stddev: "± desviación estándar",
      logScale: "escala log X",
      range: "rango {{min}}–{{max}}",
    },
    metrics: {
      DurationTime: {
        label: "Tiempo de ejecución",
        eyebrow: "Escalamiento",
        axisTitle: "Tiempo de ejecución (ms)",
        description: "Duración total de la ejecución del programa en milisegundos.\nEs una de las métricas más intuitivas para el usuario, ya que indica el tiempo real que tarda en completarse la tarea.\nSe usa como referencia principal para comparar la rapidez entre algoritmos o configuraciones.",
      },
      TaskClock: {
        label: "Tiempo activo de tarea",
        eyebrow: "CPU",
        axisTitle: "Tiempo activo (ms)",
        description: "Tiempo total de ejecución activo del proceso en milisegundos.\nIndica cuánto tiempo estuvo efectivamente ocupado el CPU ejecutando el proceso, considerando posibles hilos o tareas concurrentes.\nEs una métrica clave para comparar la rapidez entre diferentes implementaciones.",
      },
      CpuClock: {
        label: "Tiempo de CPU",
        eyebrow: "CPU",
        axisTitle: "Tiempo de CPU (ms)",
        description: "Tiempo total de CPU consumido por el programa en milisegundos.\nIncluye el tiempo de todos los núcleos y hilos usados.\nSirve para medir el costo total de procesamiento, especialmente relevante en algoritmos paralelos o con múltiples hilos.",
      },
      Instructions: {
        label: "Instrucciones ejecutadas",
        eyebrow: "Trabajo de CPU",
        axisTitle: "Instrucciones",
        description: "Número total de instrucciones ejecutadas por el CPU durante la ejecución del programa.\nRefleja la cantidad de operaciones básicas necesarias para completar la tarea.\nUn menor número de instrucciones, si se mantiene el mismo resultado, puede indicar un código más optimizado y eficiente.\nSin embargo, no siempre menos es mejor: depende de la calidad de la implementación y del tipo de algoritmo.",
      },
      CpuCycles: {
        label: "Ciclos de CPU",
        eyebrow: "CPU",
        axisTitle: "Ciclos",
        description: "Cantidad total de ciclos de reloj del CPU utilizados para ejecutar el programa.\nCada ciclo de CPU representa un 'tick' donde el procesador puede ejecutar parte de una instrucción.\nComparar ciclos con instrucciones permite calcular la eficiencia real (IPC).\nMenos ciclos para la misma cantidad de instrucciones indica un uso más eficiente del procesador.",
      },
      IPC: {
        label: "Instrucciones por ciclo (IPC)",
        eyebrow: "Eficiencia de CPU",
        axisTitle: "IPC",
        description: "Instructions Per Cycle (IPC), o Instrucciones por Ciclo.\nCalculado como Instructions / CpuCycles.\nMide cuántas instrucciones se ejecutan en promedio por ciclo de CPU.\nUn IPC alto indica un mejor aprovechamiento del procesador y mayor eficiencia.\nEste valor depende del tipo de tarea y de cómo el compilador y el CPU gestionan el flujo de instrucciones.",
      },
      Branches: {
        label: "Saltos ejecutados",
        eyebrow: "Flujo de control",
        axisTitle: "Saltos",
        description: "Número total de bifurcaciones o saltos condicionales ejecutados, como if, loops o jumps.\nEl procesador necesita predecir estas bifurcaciones para mantener el flujo eficiente de ejecución.\nMuchos branches pueden hacer el flujo menos predecible, dificultando la optimización.",
      },
      BranchMisses: {
        label: "Fallos de predicción de salto",
        eyebrow: "Flujo de control",
        axisTitle: "Fallos de predicción",
        description: "Cantidad de fallos en la predicción de bifurcaciones.\nCuando el procesador predice incorrectamente, se produce un 'branch misprediction', obligando a descartar instrucciones ya procesadas y reiniciar el flujo correcto.\nEsto penaliza el rendimiento y aumenta la latencia.",
      },
      BranchMissRate: {
        label: "Tasa de fallos de predicción",
        eyebrow: "Flujo de control",
        axisTitle: "Tasa de fallos (%)",
        description: "Tasa de fallos en predicción de bifurcaciones.\nCalculada como BranchMisses / Branches.\nRefleja qué tan bien el procesador logra predecir los saltos en el flujo del programa (if, loops).\nUna tasa baja significa menor penalización y mayor aprovechamiento del pipeline, lo que se traduce en mejor rendimiento.",
      },
      BranchMissesPerMI: {
        label: "Fallos de salto por millón de instrucciones",
        eyebrow: "Flujo de control",
        axisTitle: "Fallos / millón de instrucciones",
        description: "Fallos de predicción de saltos por millón de instrucciones.\nCalculada como BranchMisses / (Instructions / 1e6).\nEste indicador complementa a BranchMissRate, pero al estar expresado por unidad de trabajo (instrucciones ejecutadas) facilita la comparación entre implementaciones con diferente volumen de instrucciones.\nValores bajos sugieren un flujo de control más predecible y eficiente.",
      },
      CacheReferences: {
        label: "Referencias de caché",
        eyebrow: "Memoria",
        axisTitle: "Referencias de caché",
        description: "Referencias de caché reportadas por el contador genérico de rendimiento del sistema.\nRepresentan actividad de caché según la semántica que expone el PMU del procesador; su correspondencia exacta con un nivel concreto puede variar entre arquitecturas.\nSe interpreta principalmente junto con CacheMisses y no como un conteo universal de todos los accesos a todos los niveles de caché.",
      },
      CacheMisses: {
        label: "Fallos de caché",
        eyebrow: "Memoria",
        axisTitle: "Fallos de caché",
        description: "Fallos de caché reportados por el contador genérico de rendimiento del sistema.\nLa correspondencia exacta del evento depende de la arquitectura y del PMU, por lo que no debe interpretarse automáticamente como la suma de fallos de todos los niveles ni como una garantía de acceso posterior a RAM.\nSe utiliza junto con CacheReferences para estudiar la proporción de fallos observada por el contador disponible.",
      },
      CacheMissRate: {
        label: "Tasa de fallos de caché",
        eyebrow: "Memoria",
        axisTitle: "Tasa de fallos (%)",
        description: "Tasa de fallos de caché.\nCalculada como CacheMisses / CacheReferences.\nExpresa la proporción entre los fallos y las referencias reportadas por los contadores genéricos disponibles en ese hardware.\nUna tasa menor puede indicar un patrón de acceso más favorable, pero su interpretación debe considerar la arquitectura y la semántica del PMU utilizado.",
      },
      CacheMissesPerMI: {
        label: "Fallos de caché por millón de instrucciones",
        eyebrow: "Memoria",
        axisTitle: "Fallos / millón de instrucciones",
        description: "Fallos de caché por millón de instrucciones.\nCalculada como CacheMisses / (Instructions / 1e6).\nEste indicador normaliza los fallos de caché respecto al volumen total de instrucciones ejecutadas, permitiendo una comparación más justa entre algoritmos de diferente tamaño.\nValores bajos reflejan una mejor localidad de datos y mayor eficiencia en el uso de la jerarquía de memoria.",
      },
      L1DcacheLoads: {
        label: "Lecturas de caché L1",
        eyebrow: "Memoria",
        axisTitle: "Lecturas L1",
        description: "Número de lecturas desde la caché L1 de datos (primer nivel).\nL1 (Level 1): caché más cercana al núcleo del CPU, extremadamente rápida pero pequeña (normalmente 32-64 KB).\nAcceder a L1 significa mínima latencia y máximo rendimiento.\nUn alto número de lecturas exitosas en L1 es deseable porque reduce la dependencia de niveles más lentos (L2, L3 y RAM).",
      },
      L1DcacheLoadMisses: {
        label: "Fallos de lectura en caché L1",
        eyebrow: "Memoria",
        axisTitle: "Fallos de lectura L1",
        description: "Cantidad de fallos al leer en la caché L1 de datos.\nCuando ocurre un fallo en L1, el CPU debe buscar en la caché L2 o L3, o en última instancia en la RAM, lo cual es mucho más lento.\nMinimizar estos fallos es crítico para mantener la eficiencia y evitar cuellos de botella de memoria.\n\nSobre jerarquía de caché:\n- L1: la más rápida y cercana, pequeña.\n- L2: intermedia, más grande, compartida por menos núcleos.\n- L3: última línea de defensa antes de RAM, más grande y más lenta.",
      },
      L1DcacheStores: {
        label: "Escrituras de caché L1",
        eyebrow: "Memoria",
        axisTitle: "Escrituras L1",
        description: "Número de escrituras en la caché L1 de datos.\nAlmacenar datos en L1 permite que operaciones posteriores (como bucles o acumulaciones) se ejecuten de manera extremadamente rápida.\nUn uso eficiente de la L1 evita presión en los niveles superiores y reduce los tiempos de acceso globales.",
      },
      LLCLoads: {
        label: "Lecturas de último nivel de caché",
        eyebrow: "Memoria",
        axisTitle: "Lecturas LLC",
        description: "Número de lecturas realizadas desde la LLC (Last Level Cache), que en la mayoría de los sistemas modernos corresponde a la caché L3.\nL3 (Level 3): más grande y más lenta que L1 y L2, suele ser compartida por varios núcleos.\nAcceder a la LLC es mucho más rápido que ir a la RAM, pero más lento que L1 o L2.\nAlta actividad en LLC puede indicar acceso frecuente a datos compartidos entre hilos o núcleos.",
      },
      LLCLoadMisses: {
        label: "Fallos de lectura en último nivel de caché",
        eyebrow: "Memoria",
        axisTitle: "Fallos de lectura LLC",
        description: "Cantidad de fallos al intentar leer en la LLC (Last Level Cache, normalmente L3).\nCuando se produce un fallo aquí, el CPU se ve obligado a buscar datos en la memoria RAM, lo que introduce mucha más latencia.\nReducir estos fallos mejora significativamente el rendimiento general y el consumo energético.",
      },
      LLCStores: {
        label: "Escrituras de último nivel de caché",
        eyebrow: "Memoria",
        axisTitle: "Escrituras LLC",
        description: "Número de escrituras en la LLC (Last Level Cache, normalmente L3).\nEste nivel se usa para almacenar datos que podrían necesitar otros núcleos y para preparar escritura en RAM.\nUn uso eficiente ayuda a reducir la congestión en la RAM y facilita el trabajo en paralelo.",
      },
      LLCStoreMisses: {
        label: "Fallos de escritura en último nivel de caché",
        eyebrow: "Memoria",
        axisTitle: "Fallos de escritura LLC",
        description: "Cantidad de fallos al escribir en la LLC (Last Level Cache).\nCuando ocurre un fallo, se debe escribir directamente en la memoria RAM, lo que es mucho más lento y costoso.\nMinimizar estos fallos implica un mejor diseño de estructuras de datos y un acceso más coherente a la memoria.",
      },
      PageFaults: {
        label: "Fallos de página",
        eyebrow: "Sistema",
        axisTitle: "Fallos de página",
        description: "Cantidad de fallos de página.\nSe producen cuando el proceso accede a una página de memoria que no está en la RAM y necesita ser cargada desde disco.\nLos fallos de página son una señal de que el programa está utilizando más memoria de la que puede mantener activa, lo que degrada drásticamente el rendimiento.",
      },
      MajorFaults: {
        label: "Fallos de página mayores",
        eyebrow: "Sistema",
        axisTitle: "Fallos mayores",
        description: "Cantidad de fallos de página 'mayores'.\nEstos requieren que el sistema operativo cargue datos desde disco o swap.\nSon extremadamente costosos en tiempo y afectan negativamente el rendimiento general.\nReducir el uso excesivo de memoria y optimizar el acceso ayuda a disminuir estos fallos.",
      },
      EnergyPkg: {
        label: "Energía del paquete CPU",
        eyebrow: "Energía",
        axisTitle: "Energía (J)",
        description: "Energía registrada por el dominio físico CPU Package durante la ventana de medición del benchmark (J).\nLa lectura corresponde al dominio energético expuesto por la plataforma y no atribuye de forma exclusiva ese consumo al proceso del estudiante.\nSolo se muestra cuando el backend de medición entrega muestras numéricas válidas.",
      },
      EnergyCores: {
        label: "Energía de núcleos",
        eyebrow: "Energía",
        axisTitle: "Energía (J)",
        description: "Energía registrada por el dominio físico de núcleos CPU durante la ventana de medición del benchmark (J), cuando dicho dominio está expuesto por la plataforma y es accesible al backend.\nNo debe interpretarse como energía exclusiva del proceso ni como una medida disponible en todo hardware.",
      },
      EnergyRAM: {
        label: "Energía de RAM",
        eyebrow: "Energía",
        axisTitle: "Energía (J)",
        description: "Energía registrada por el dominio de memoria/DRAM durante la ventana de medición del benchmark (J), únicamente cuando la plataforma expone ese dominio y el backend puede medirlo.\nLa ausencia de esta métrica se representa como no disponible; nunca se sustituye por cero.",
      },
    },
  },


  teacherCommon: {
    actions: {
      retry: "Reintentar",
    },
    errors: {
      network:
        "No pudimos conectar con el servidor. Comprueba que el backend esté disponible e inténtalo nuevamente.",
      session:
        "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
      forbidden:
        "Tu cuenta no tiene permisos para realizar esta acción.",
      notFound:
        "La información solicitada no está disponible.",
      service:
        "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos.",
      generic:
        "No fue posible cargar la información solicitada.",
    },
  },
  teacherCourseAnalytics: {
    common: {
      unavailable: "—",
    },
    loading: "Cargando analítica",
    errors: {
      title: "No pudimos cargar la analítica",
      load:
        "No fue posible cargar la analítica del curso.",
    },
    header: {
      eyebrow: "Seguimiento agregado",
      title: "Analítica del curso",
      description:
        "Participación, benchmarks y actividad sin comparar rendimiento entre equipos.",
    },
    kpis: {
      activeStudents: "Estudiantes activos",
      submissions: "Experimentos",
      executions: "Ejecuciones",
      completionRate:
        "Tasa de ejecuciones completadas",
    },
    empty: {
      title: "Sin datos todavía",
    },
    axes: {
      students: "Estudiantes",
      executions: "Ejecuciones",
    },
    charts: {
      participation: {
        title: "Participación por estudiante",
        description:
          "Estudiantes activos agrupados por cantidad de ejecuciones.",
        buckets: {
          zero: "0 ejecuciones",
          oneToFour: "1–4",
          fiveToNine: "5–9",
          tenOrMore: "10+",
        },
        hover:
          "%{x}: %{y} estudiantes<extra></extra>",
        empty:
          "Agrega estudiantes al curso para visualizar su participación.",
      },
      benchmarks: {
        title: "Benchmarks utilizados",
        description:
          "Distribución de ejecuciones entre LCS, CAMM y SIZE.",
        hover:
          "%{label}: %{value} ejecuciones (%{percent})<extra></extra>",
        empty:
          "Las ejecuciones con benchmark aparecerán aquí.",
      },
      activity: {
        title: "Actividad temporal",
        description:
          "Ejecuciones por día en los 30 días hasta la actividad más reciente.",
        hover:
          "%{x}: %{y} ejecuciones<extra></extra>",
        empty:
          "Aún no hay ejecuciones para mostrar en la línea temporal.",
      },
    },
  },
  teacherCourseAttention: {
    common: {
      unavailable: "—",
    },
    loading:
      "Cargando atención académica",
    errors: {
      title:
        "No pudimos cargar la atención académica",
      load:
        "No fue posible cargar el resumen de atención académica.",
    },
    header: {
      eyebrow:
        "Supervisión accionable",
      title:
        "Atención académica",
      description:
        "Señales operativas para encontrar casos que conviene revisar, sin calificar ni comparar estudiantes.",
    },
    refreshing: "Actualizando…",
    actions: {
      viewStudents: "Ver estudiantes",
      result: "Resultado",
      lastResultAria:
        "Ver último resultado de {{name}}",
    },
    cards: {
      noExecutions: {
        title: "Sin ejecuciones",
        description:
          "Estudiantes activos que todavía no registran ejecuciones.",
        aria: {
          one:
            "{{count}} estudiante sin ejecuciones. Ver estudiantes.",
          other:
            "{{count}} estudiantes sin ejecuciones. Ver estudiantes.",
        },
      },
      failures: {
        title:
          "Fallos predominantes",
        description:
          "Estudiantes con más ejecuciones fallidas que completadas.",
        aria: {
          one:
            "{{count}} estudiante con más fallos que completadas. Ver estudiantes.",
          other:
            "{{count}} estudiantes con más fallos que completadas. Ver estudiantes.",
        },
      },
    },
    recent: {
      title: "Actividad reciente",
      description:
        "Últimos estudiantes con actividad registrada.",
      empty:
        "Aún no hay actividad registrada.",
    },
  },
  teacherCourses: {
    common: {
      unavailable: "—",
    },
    header: {
      eyebrow: "Supervisión docente",
      title: "Cursos",
      description:
        "Separa la actividad por semestre y revisa únicamente a los estudiantes de cada curso.",
    },
    actions: {
      create: "Crear curso",
      creating: "Creando...",
      close: "Cerrar",
      open: "Abrir",
      retry: "Reintentar",
    },
    metrics: {
      students: "Estudiantes",
      submissions: "Experimentos",
      executions: "Ejecuciones",
    },
    summary: {
      aria: "Resumen de cursos",
      activeCourses: "Cursos activos",
      historicalCourses: "Cursos históricos",
      activeStudents: "Estudiantes activos",
      registeredStudents:
        "Estudiantes registrados",
    },
    create: {
      title: "Nueva instancia académica",
      description:
        "El mismo código puede existir en años o semestres distintos sin mezclar resultados.",
      code: "Código",
      codePlaceholder: "Ej. INF-221",
      name: "Nombre",
      namePlaceholder: "Ej. Estructuras de Datos",
      year: "Año",
      semester: "Semestre",
      responsible:
        "Profesor responsable",
      selectResponsible:
        "Selecciona un responsable",
      loadingResponsibles:
        "Cargando responsables...",
    },
    toolbar: {
      aria: "Filtros de cursos",
      active: "Activos",
      historical: "Históricos",
      searchLabel: "Buscar curso",
      searchPlaceholder: "Código, nombre o profesor",
    },
    loading: "Cargando cursos",
    empty: {
      activeTitle: "Todavía no hay cursos activos",
      historyTitle: "No hay cursos históricos",
      activeDescription:
        "Crea una instancia académica para separar estudiantes y resultados por semestre.",
      historyDescription:
        "Los cursos finalizados aparecerán aquí sin perder su historial.",
    },
    card: {
      active: "Activo",
      finished: "Finalizado",
      teacherUnavailable: "Profesor no disponible",
      historicalStudents: "{{count}} estudiantes históricos",
      registeredStudents: {
        one: "{{count}} estudiante registrado",
        other: "{{count}} estudiantes registrados",
      },
      lastActivity: "Última actividad: {{value}}",
    },
    list: {
      aria: "Listado de cursos",
    },
    errors: {
      loadTitle: "No pudimos cargar los cursos",
      load: "No fue posible cargar los cursos.",
      create: "No fue posible crear el curso.",
      createValidation:
        "Revisa los datos del curso e inténtalo nuevamente.",
      validationCode:
        "Ingresa un código de curso válido.",
      validationName:
        "Ingresa un nombre de curso válido.",
      validationYear:
        "Ingresa un año académico entre 2000 y 9999.",
      validationTerm:
        "Selecciona el semestre 1 o 2.",
      validationResponsible:
        "Selecciona un profesor responsable activo.",
      responsibles:
        "No fue posible cargar los profesores responsables.",
    },
  },

  teacherCourseDetail: {
    common: {
      unavailable: "—",
    },
    status: {
      courseActive: "Activo",
      courseFinished: "Finalizado",
      membershipActive: "Activo",
      membershipRemoved: "Retirado",
    },
    attention: {
      failures: "Más fallos que completadas",
      noExecutions: "Sin ejecuciones",
      none: "Sin alerta",
    },
    enrollment: {
      notEligible:
        "Cuenta no disponible para inscripción",
      rejectedGeneric:
        "No fue posible agregar",
      resultTitle:
        "Resultado de la carga",
      added: {
        one: "{{count}} agregado",
        other: "{{count}} agregados",
      },
      reactivated: {
        one: "{{count}} reactivado",
        other: "{{count}} reactivados",
      },
      alreadyActive: {
        one: "{{count}} ya activo",
        other: "{{count}} ya activos",
      },
      rejected: {
        one: "{{count}} rechazado",
        other: "{{count}} rechazados",
      },
    },
    actions: {
      back: "← Volver a cursos",
      export: "Exportar CSV",
      exporting: "Exportando...",
      edit: "Editar",
      closeEdit: "Cerrar edición",
      finishCourse: "Finalizar curso",
      reactivateCourse: "Reactivar curso",
      save: "Guardar cambios",
      saving: "Guardando...",
      close: "Cerrar",
      addStudents: "Agregar estudiantes",
      addToCourse: "Agregar al curso",
      adding: "Agregando...",
      viewProfile: "Ver ficha",
      lastResult: "Último resultado",
      remove: "Retirar",
      restore: "Restaurar",
      previous: "Anterior",
      next: "Siguiente",
      cancel: "Cancelar",
      cloneCourse: "Clonar curso",
    },
    export: {
      title:
        "Exporta todos los estudiantes activos del curso",
      success:
        "Resumen CSV descargado correctamente.",
    },
    edit: {
      title: "Editar curso",
      description:
        "Cambia los metadatos de esta instancia académica.",
      code: "Código",
      name: "Nombre",
      year: "Año",
      semester: "Semestre",
      responsible:
        "Profesor responsable",
      selectResponsible:
        "Selecciona un responsable",
      loadingResponsibles:
        "Cargando responsables...",
    },
    students: {
      title: "Estudiantes",
      description:
        "Gestiona la lista del curso sin eliminar cuentas ni resultados históricos.",
      addDisabledTitle:
        "Reactiva el curso para agregar estudiantes.",
      emailLabel:
        "Correos de estudiantes",
      emailPlaceholder:
        "alumno1@inf.udec.cl\nalumno2@inf.udec.cl\nalumno3@inf.udec.cl",
      help:
        "Puedes pegar una lista separada por saltos de línea, espacios, comas o punto y coma. Deben corresponder a cuentas de estudiantes registradas en la plataforma.",
      emailsDetected: {
        one: "{{count}} correo detectado",
        other:
          "{{count}} correos detectados",
      },
      emailLimit:
        "El máximo es {{max}}. Reduce la lista antes de continuar.",
      restoreSuccess:
        "El estudiante fue restaurado en el curso.",
      membership: {
        active: "Activos",
        inactive: "Retirados",
        all: "Todos",
      },
      searchLabel:
        "Buscar estudiantes",
      searchPlaceholder:
        "Buscar nombre o correo",
      attentionFilterLabel:
        "Filtrar por atención",
      attentionFilter: {
        all: "Todas las situaciones",
        noExecutions: "Sin ejecuciones",
        failures:
          "Más fallos que completadas",
      },
      loading:
        "Cargando estudiantes",
      emptyTitle:
        "Sin estudiantes para mostrar",
      emptyDescription:
        "Ajusta los filtros o agrega estudiantes al curso.",
      table: {
        student: "Estudiante",
        status: "Estado",
        submissions: "Experimentos",
        executions: "Ejecuciones",
        completed: "Completadas",
        failed: "Fallidas",
        lastActivity:
          "Última actividad",
        attention: "Atención",
        action: "Acción",
      },
      noResultTitle:
        "Este estudiante todavía no tiene resultados completados",
      count: {
        one: "{{count}} estudiante",
        other: "{{count}} estudiantes",
      },
      page:
        "Página {{page}} de {{total}}",
    },
    confirm: {
      finishCourse:
        "¿Confirmas finalizar el curso {{code}} {{period}}?",
      reactivateCourse:
        "¿Confirmas reactivar el curso {{code}} {{period}}?",
      removeStudent:
        "¿Retirar a {{name}} del curso? Sus resultados no serán eliminados.",
    },
    modals: {
      finish: {
        title: "Finalizar curso",
      },
      reactivate: {
        title: "Reactivar curso",
      },
      removeStudent: {
        title: "Retirar estudiante",
        description:
          "Retirarás a {{name}} ({{email}}) de la nómina activa.",
        preservedHistory:
          "La cuenta del usuario, sus experimentos y sus resultados históricos no se eliminarán.",
      },
    },
    clone: {
      title: "Clonar curso",
      description:
        "Crea una nueva instancia de {{code}} a partir del período {{period}}.",
      copyStudents:
        "Copiar estudiantes activos",
      noActivityCopy:
        "Los experimentos, ejecuciones y resultados no se copiarán.",
    },
    loading: "Cargando curso",
    errors: {
      loadTitle:
        "No pudimos cargar el curso",
      load:
        "No fue posible cargar el curso.",
      updateCourse:
        "No fue posible actualizar el curso.",
      saveCourse:
        "No fue posible guardar el curso.",
      addStudents:
        "No fue posible agregar estudiantes.",
      removeStudent:
        "No fue posible retirar al estudiante.",
      restoreStudent:
        "No fue posible restaurar al estudiante.",
      export:
        "No fue posible exportar el resumen del curso.",
      validationCode:
        "Ingresa un código de curso válido.",
      validationName:
        "Ingresa un nombre de curso válido.",
      validationYear:
        "Ingresa un año académico entre 2000 y 9999.",
      validationTerm:
        "Selecciona el semestre 1 o 2.",
      validationEmails:
        "Ingresa uno o más correos de estudiantes válidos.",
      validationResponsible:
        "Selecciona un profesor responsable activo.",
      responsibles:
        "No fue posible cargar los profesores responsables.",
      cloneCourse:
        "No fue posible clonar el curso.",
    },
  },

  teacherStudentDetail: {
    common: {
      unavailable: "—",
    },
    actions: {
      back: "← Volver al curso",
      retry: "Reintentar",
      previous: "Anterior",
      next: "Siguiente",
      viewDetail: "Ver detalle",
      close: "Cerrar",
      viewExperiment:
        "Ver experimento",
      viewResults:
        "Ver resultados",
    },
    profile: {
      loading:
        "Cargando ficha del estudiante",
      errors: {
        title:
          "No pudimos cargar la ficha",
        load:
          "No fue posible cargar la ficha.",
      },
      eyebrow:
        "Estudiante del curso",
      membership: {
        active: "En el curso",
        removed: "Retirado",
      },
      lastActivity:
        "Última actividad",
      lastAccess:
        "Último acceso",
    },
    summary: {
      submissions: "Experimentos",
      executions: "Ejecuciones",
      completed: "Completadas",
      failed: "Fallidas",
      active: "Activas",
    },
    tabs: {
      executions: "Ejecuciones",
      submissions: "Experimentos",
    },
    states: {
      queued: "En cola",
      running: "Ejecutando",
      processing: "Procesando",
      completed: "Completada",
      failed: "Fallida",
      cancelled: "Cancelada",
    },
    pagination: {
      records: {
        one: "{{count}} registro",
        other: "{{count}} registros",
      },
      page:
        "Página {{page}} de {{total}}",
    },
    executions: {
      searchLabel:
        "Buscar ejecución",
      searchPlaceholder:
        "Título del experimento",
      statusLabel: "Estado",
      statusAll: "Todos",
      loading:
        "Cargando ejecuciones",
      emptyTitle:
        "Sin ejecuciones en este curso",
      emptyDescription:
        "No existen ejecuciones que coincidan con los filtros actuales.",
      errors: {
        title:
          "No pudimos cargar las ejecuciones",
        load:
          "No fue posible cargar las ejecuciones.",
      },
      table: {
        execution: "Ejecución",
        source: "Fuente",
        submission: "Experimento",
        state: "Estado",
        duration: "Duración",
        hardware: "Hardware",
        updated: "Actualizada",
        detail: "Detalle",
      },
      noCodename: "Sin codename",
      sourceFallback:
        "Fuente no disponible",
      submissionFallback:
        "Experimento #{{id}}",
    },

    modal: {
      eyebrow: "Detalle técnico",
      title:
        "Ejecución #{{id}}",
      closeAria: "Cerrar",
      loading:
        "Cargando detalle",
      errors: {
        title:
          "No pudimos cargar la ejecución",
        load:
          "No fue posible cargar el detalle.",
      },
      summary: {
        source: "Fuente",
        submission: "Experimento",
        benchmark: "Benchmark",
        state: "Estado",
        duration: "Duración",
      },
      configuration: {
        title: "Configuración",
        input: "Input máximo",
        samplesPerPoint:
          "Muestras/punto",
        points: "Puntos",
        warmup: "Calentamiento",
        profile: "Perfil",
        compilation: "Compilación",
      },
      hardware: {
        title:
          "Hardware y medición",
        cpu: "CPU",
        architecture:
          "Arquitectura",
        logicalCpus:
          "CPU lógicas",
        backend: "Backend",
        scope: "Ámbito",
        result: "Resultado",
        available: "Disponible",
        unavailable:
          "No disponible",
      },
      failure: {
        title:
          "Fallo registrado",
        noCode: "Sin código",
        noMessage:
          "Sin mensaje adicional.",
      },
    },
    submissions: {
      searchLabel:
        "Buscar experimento",
      searchPlaceholder:
        "Título del experimento",
      loading: "Cargando experimentos",
      emptyTitle:
        "Sin experimentos en este curso",
      emptyDescription:
        "Este estudiante todavía no tiene experimentos asociados a esta instancia académica.",
      errors: {
        title:
          "No pudimos cargar los experimentos",
        load:
          "No fue posible cargar los experimentos.",
      },
      table: {
        submission: "Experimento",
        status: "Estado",
        executions: "Ejec.",
        completed: "Completadas",
        failed: "Fallidas",
        active: "Activas",
        created: "Creado",
      },
      status: {
        noExecutions:
          "Sin ejecuciones",
        active:
          "Con ejecuciones activas",
        completed: "Completada",
        failed: "Con fallos",
        mixed: "Mixta",
        unknown:
          "Sin estado derivado",
      },
      fallback:
        "Experimento #{{id}}",
    },
  },

  adminCommon: {
    roles: {
      Student: "Estudiante",
      Teacher: "Docente",
      Admin: "Administrador",
      unknown: "Sin rol",
    },
    accountStatus: {
      active: "Activo",
      inactive: "Inactivo",
      unknown: "Desconocido",
    },
    executionStates: {
      all: "Todos",
      queued: "En cola",
      running: "En ejecución",
      processing: "Procesando",
      completed: "Completado",
      failed: "Error",
      cancelled: "Cancelada",
      unknown: "Desconocido",
      none: "Sin ejecuciones",
    },
  },

  adminUsers: {
    header: {
      eyebrow: "Administración",
      title: "Usuarios",
      description:
        "Gestiona cuentas y revisa su actividad reciente en Performance System.",
    },
    summary: {
      aria: "Resumen de usuarios",
      total: "Total",
      totalCaption:
        "usuarios registrados",
      active: "Activos",
      activeCaption:
        "con acceso habilitado",
      inactive: "Inactivos",
      inactiveCaption:
        "sin acceso habilitado",
      results: "Resultados",
      visible: "Visibles",
      filteredCaption:
        "coinciden con los filtros",
      visibleCaption:
        "usuarios disponibles",
    },
    filters: {
      search: "Buscar",
      searchPlaceholder:
        "Nombre o correo institucional",
      role: "Rol",
      roleAll: "Todos",
      status: "Estado",
      statusAll: "Todos",
      sort: "Orden",
      sortRecent:
        "Actividad reciente",
      sortName: "Nombre",
      sortCreated:
        "Fecha de creación",
      clear: "Limpiar",
    },
    table: {
      user: "Usuario",
      role: "Rol",
      account: "Cuenta",
      activity: "Actividad",
      lastExecution:
        "Última ejecución",
      action: "Acción",
    },
    loading: {
      title:
        "Cargando usuarios",
      description:
        "Consultando el listado administrativo.",
    },
    errors: {
      title:
        "No pudimos cargar los usuarios",
      network:
        "No fue posible conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.",
      session:
        "Tu sesión expiró. Inicia sesión nuevamente.",
      forbidden:
        "Tu cuenta no tiene permisos para consultar este listado.",
      service:
        "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos.",
      generic:
        "No se pudo cargar la información de usuarios. Puedes reintentar sin abandonar esta pantalla.",
    },
    actions: {
      retry: "Reintentar",
      viewUser: "Ver usuario",
      clearFilters:
        "Limpiar filtros",
      previous: "Anterior",
      next: "Siguiente",
    },
    fallbacks: {
      name:
        "Usuario sin nombre",
      email: "Sin correo",
      unavailable: "—",
    },
    created:
      "Creado {{date}}",
    activity: {
      submissions: {
        one: "{{count}} experimento",
        other: "{{count}} experimentos",
      },
      executions: {
        one: "{{count}} ejecución",
        other: "{{count}} ejecuciones",
      },
      completed: {
        one: "{{count}} completada",
        other: "{{count}} completadas",
      },
      failed: {
        one: "{{count}} fallida",
        other: "{{count}} fallidas",
      },
      active: {
        one: "{{count}} activa",
        other: "{{count}} activas",
      },
    },
    empty: {
      title:
        "No hay usuarios para mostrar",
      filtered:
        "No hay coincidencias con los filtros actuales.",
      unfiltered:
        "Todavía no hay usuarios registrados.",
    },
    pagination: {
      zero: "0 usuarios",
      range:
        "{{first}}–{{last}} de {{total}}",
      rows: "Filas",
      pageSizeAria:
        "Cantidad de usuarios por página",
      page:
        "Página {{page}} de {{total}}",
    },
  },

  adminLayout: {
    navAria: "Secciones de administración",
    users: "Usuarios",
    accessRequests: "Solicitudes",
    auditLog: "Auditoría",
    pending: {
      one:
        "{{count}} solicitud de acceso pendiente",
      other:
        "{{count}} solicitudes de acceso pendientes",
    },
  },

  adminUserDetail: {
    fallbacks: {
      name:
        "Usuario sin nombre",
      email: "Sin correo",
      unavailable: "—",
    },
    actions: {
      back:
        "← Volver a usuarios",
      retry: "Reintentar",
      clearFilters:
        "Limpiar filtros",
      previous: "Anterior",
      next: "Siguiente",
      viewDetail:
        "Ver detalle",
      clearSearch:
        "Limpiar búsqueda",
      close: "Cerrar",
      viewExperiment:
        "Ver experimento",
      viewResults:
        "Ver resultados",
      cancel: "Cancelar",
      promoteTeacher:
        "Promover a profesor",
      changeToStudent:
        "Cambiar a estudiante",
    },
    header: {
      eyebrow:
        "Administración",
      title:
        "Detalle de usuario",
      description:
        "Perfil, experimentos, ejecuciones y actividad administrativa.",
    },
    loading: {
      title:
        "Cargando usuario",
      description:
        "Consultando perfil y actividad.",
    },
    errors: {
      title:
        "No pudimos cargar el usuario",
      load:
        "No se pudo cargar el perfil del usuario.",
      network:
        "No fue posible conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.",
      session:
        "Tu sesión expiró. Inicia sesión nuevamente.",
      forbidden:
        "Tu cuenta no tiene permisos para consultar este usuario.",
      notFound:
        "El usuario solicitado no está disponible.",
      service:
        "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos.",
      changeRole:
        "No fue posible cambiar el rol del usuario.",
    },
    profile: {
      created: "Creado",
      lastLogin:
        "Última sesión",
      lastActivity:
        "Última ejecución",
    },
    roleChange: {
      title: "Gestión de rol",
      description:
        "Cambia entre los roles Estudiante y Profesor con las validaciones académicas correspondientes.",
      modalTitle:
        "Confirmar cambio de rol",
      promoteDescription:
        "Promoverás a {{name}} ({{email}}) al rol Profesor.",
      demoteDescription:
        "Cambiarás a {{name}} ({{email}}) al rol Estudiante. La operación se bloqueará si conserva cursos asignados.",
      assignedCoursesError:
        "Cursos asignados: {{count}}. Transfiérelos antes de cambiar el rol.",
    },
    summary: {
      submissions: "Experimentos",
      executions: "Ejecuciones",
      completed: "Completadas",
      failed: "Fallidas",
      active: "Activas",
    },
    tabs: {
      aria:
        "Detalle administrativo",
      executions:
        "Ejecuciones",
      submissions:
        "Experimentos",
      audit: "Actividad",
    },
    pagination: {
      zero: "0 registros",
      range:
        "{{first}}–{{last}} de {{total}}",
      page:
        "Página {{page}} de {{total}}",
    },
    executions: {
      title: "Ejecuciones",
      description:
        "Historial técnico basado en los estados canónicos de ejecución.",
      kpis: {
        completed:
          "completadas",
        failed: "fallidas",
        active: "activas",
      },
      searchLabel:
        "Buscar experimento",
      searchPlaceholder:
        "Ej. LCS, SIZE, CAMMR...",
      statusLabel: "Estado",
      errors: {
        title:
          "No pudimos cargar las ejecuciones",
        load:
          "No se pudieron cargar las ejecuciones.",
      },
      loading: {
        title:
          "Cargando ejecuciones",
        description:
          "Consultando el historial del usuario.",
      },
      empty: {
        title:
          "No hay ejecuciones para mostrar",
        filtered:
          "No hay coincidencias con los filtros actuales.",
        unfiltered:
          "Este usuario todavía no tiene ejecuciones registradas.",
      },
      table: {
        execution: "Ejecución",
        source: "Fuente",
        submission: "Experimento",
        state: "Estado",
        duration: "Duración",
        hardware: "Hardware",
        updated: "Actualizada",
        detail: "Detalle",
      },
      noCodename:
        "Sin codename",
      sourceFallback:
        "Fuente no disponible",
      submissionFallback:
        "Experimento #{{id}}",
    },
    submissions: {
      title: "Experimentos",
      description:
        "Experimentos del usuario y distribución de sus ejecuciones.",
      total:
        "{{count}} total",
      searchLabel:
        "Buscar experimento",
      searchPlaceholder:
        "Título del experimento",
      errors: {
        title:
          "No pudimos cargar los experimentos",
        load:
          "No se pudieron cargar los experimentos.",
      },
      loading: {
        title:
          "Cargando experimentos",
        description:
          "Consultando los experimentos del usuario.",
      },
      empty: {
        title:
          "No hay experimentos para mostrar",
        filtered:
          "No hay coincidencias con la búsqueda actual.",
        unfiltered:
          "Este usuario todavía no tiene experimentos registrados.",
      },
      table: {
        submission: "Experimento",
        status: "Estado",
        executions: "Ejecuciones",
        completed: "Completadas",
        failed: "Fallidas",
        active: "Activas",
        created: "Creado",
      },
      status: {
        approved:
          "Con ejecuciones aprobadas",
        errors:
          "Con errores recurrentes",
        mixed: "Mixto",
        review: "En revisión",
      },
      fallback:
        "Experimento #{{id}}",
    },
    audit: {
      title: "Actividad",
      description:
        "Acciones persistidas en el registro de auditoría.",
      total:
        "{{count}} eventos",
      errors: {
        title:
          "No pudimos cargar la actividad",
        load:
          "No se pudo cargar el historial de acciones.",
      },
      loading: {
        title:
          "Cargando actividad",
        description:
          "Consultando el registro de auditoría.",
      },
      empty: {
        title:
          "Sin actividad registrada",
        description:
          "No existen eventos de auditoría asociados a este usuario.",
      },
      fallbackAction: "Acción",
      fallbackDescription:
        "Sin descripción registrada.",
    },
    modal: {
      eyebrow:
        "Detalle técnico",
      title:
        "Ejecución #{{id}}",
      closeAria:
        "Cerrar detalle",
      loading: {
        title:
          "Cargando detalle",
        description:
          "Consultando la ejecución canónica.",
      },
      errors: {
        title:
          "No pudimos cargar el detalle",
        load:
          "No se pudo cargar el detalle de la ejecución.",
      },
      summary: {
        source: "Fuente",
        submission: "Experimento",
        benchmark: "Benchmark",
        state: "Estado",
        duration: "Duración",
      },
      submissionFallback:
        "Experimento #{{id}}",
      configuration: {
        title: "Configuración",
        input: "Input máximo",
        samplesPerPoint:
          "Muestras/punto",
        points: "Puntos",
        warmup: "Warmup",
        profile: "Perfil",
        compilation: "Compilación",
      },
      hardware: {
        title:
          "Hardware y medición",
        cpu: "CPU",
        architecture:
          "Arquitectura",
        logicalCpus:
          "CPU lógicas",
        backend: "Backend",
        scope: "Scope",
        result: "Resultado",
        available: "Disponible",
        unavailable:
          "No disponible",
      },
      failure: {
        title:
          "Fallo registrado",
        noCode: "Sin código",
        unknownStage:
          "Etapa desconocida",
        noMessage:
          "Sin mensaje adicional.",
      },
      timestamps: {
        started:
          "Iniciada {{date}}",
        processing:
          "Procesando {{date}}",
        finished:
          "Finalizada {{date}}",
      },
    },
  },

  commonErrors: {
    network:
      "No pudimos conectar con el servidor. Comprueba que el backend esté disponible e inténtalo nuevamente.",
    session:
      "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
    forbidden:
      "Tu cuenta no tiene permisos para realizar esta acción.",
    notFound:
      "El recurso solicitado no está disponible.",
    service:
      "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos.",
    generic:
      "No fue posible completar la solicitud. Inténtalo nuevamente.",
    conflict:
      "La solicitud ya fue resuelta.",
  },

  adminAccessRequests: {
    header: {
      eyebrow: "Administración",
      title:
        "Solicitudes de acceso",
      description:
        "Revisa y resuelve solicitudes de acceso institucional.",
    },
    summary: {
      aria:
        "Resumen de solicitudes de acceso",
      pending: "Pendientes",
      approved: "Aprobadas",
      rejected: "Rechazadas",
    },
    filters: {
      search: "Buscar",
      searchPlaceholder:
        "Nombre, correo o curso",
      status: "Estado",
    },
    status: {
      pending: "Pendiente",
      approved: "Aprobada",
      rejected: "Rechazada",
      pendingPlural:
        "Pendientes",
      approvedPlural:
        "Aprobadas",
      rejectedPlural:
        "Rechazadas",
      all: "Todas",
    },
    table: {
      user: "Usuario",
      course:
        "Curso / profesor",
      comment: "Comentario",
      status: "Estado",
      date: "Fecha",
      action: "Acción",
    },
    loading: {
      title:
        "Cargando solicitudes",
    },
    errors: {
      title:
        "No pudimos cargar las solicitudes",
      load:
        "No fue posible cargar las solicitudes de acceso.",
      resolve:
        "No fue posible procesar la solicitud.",
    },
    empty: {
      title:
        "No hay solicitudes para mostrar",
    },
    actions: {
      retry: "Reintentar",
      approve: "Aprobar",
      reject: "Rechazar",
      cancel: "Cancelar",
      previous: "Anterior",
      next: "Siguiente",
    },
    modal: {
      approveTitle:
        "Aprobar solicitud de acceso #{{id}}",
      rejectTitle:
        "Rechazar solicitud de acceso #{{id}}",
      approveDescription:
        "Confirma la aprobación de esta solicitud de acceso institucional.",
      rejectDescription:
        "Confirma el rechazo de esta solicitud de acceso institucional.",
      user: "Usuario",
      course: "Curso",
      professor:
        "Profesor responsable",
      rejectReason:
        "Motivo de rechazo (opcional)",
      rejectReasonPlaceholder:
        "Agrega contexto para esta decisión",
    },
    resolution: {
      resolved: "Resuelta",
    },
    pagination: {
      requests: {
        one: "{{count}} solicitud",
        other:
          "{{count}} solicitudes",
      },
      page:
        "Página {{page}} de {{total}}",
    },
    fallbacks: {
      unavailable: "—",
      unknownStatus:
        "Estado desconocido",
    },
  },

  adminAuditLog: {
    header: {
      eyebrow: "Administración",
      title: "Auditoría",
      description:
        "Registro persistido de acciones administrativas.",
    },
    filters: {
      action: "Acción",
      allActions:
        "Todas las acciones",
      from: "Desde",
      to: "Hasta",
    },
    actionLabels: {
      approveAccessRequest:
        "Solicitud de acceso aprobada",
      rejectAccessRequest:
        "Solicitud de acceso rechazada",
      createCourse:
        "Curso creado",
      updateCourse:
        "Curso actualizado",
      transferCourseTeacher:
        "Responsable de curso transferido",
      cloneCourse:
        "Curso clonado",
      addCourseStudents:
        "Carga de estudiantes procesada",
      removeCourseStudent:
        "Estudiante retirado del curso",
      restoreCourseStudent:
        "Estudiante restaurado en el curso",
      rerunSubmission:
        "Reejecución de experimento solicitada",
      changeUserRole:
        "Rol de usuario modificado",
      unknown:
        "Acción desconocida",
    },
    loading: {
      title:
        "Cargando auditoría",
    },
    errors: {
      title:
        "No pudimos cargar la auditoría",
      load:
        "No fue posible cargar la auditoría.",
    },
    empty: {
      title:
        "Sin eventos para mostrar",
    },
    actions: {
      clear: "Limpiar",
      retry: "Reintentar",
      previous: "Anterior",
      next: "Siguiente",
    },
    pagination: {
      events: {
        one: "{{count}} evento",
        other:
          "{{count}} eventos",
      },
      page:
        "Página {{page}} de {{total}}",
    },
    fallbacks: {
      action: "Acción",
      description:
        "Sin descripción registrada.",
      user:
        "Usuario no disponible",
      unavailable: "—",
    },
  },

  tutorialPage: {
    screenshot: {
      expandAria: "Ampliar captura: {{alt}}",
      zoom: "Ampliar",
    },
    hero: {
      eyebrow: "Guía de uso",
      title: "Cómo funciona Performance System",
      subtitle:
        "Desde la carga del código hasta la interpretación de resultados: una guía breve para ejecutar mediciones reproducibles de algoritmos en C++ / .cpp.",
      featuresAria: "Características",
      badges: {
        controlled: "Ejecución controlada",
        performance: "Métricas de rendimiento",
        visualization: "Visualización y análisis",
      },
    },
    flow: {
      kicker: "Flujo principal",
      title: "De tu código a una medición interpretable",
      description:
        "El sistema separa la preparación del experimento, la ejecución y la presentación de resultados para que cada etapa sea trazable.",
      visualReferenceLabel: "Referencia visual:",
      visualReferenceText:
        "las capturas actuales corresponden a la interfaz en español y fueron tomadas en modo oscuro. La ubicación y el funcionamiento de los controles son equivalentes en inglés y en modo claro.",
      step1: {
        title: "Prepara y sube tu proyecto",
        description:
          "Carga un archivo ZIP con tu implementación en C++ (.cpp). Performance System valida el archivo antes de incorporarlo al experimento.",
        shot: {
          alt: "Archivo ZIP seleccionado en el formulario de nuevo análisis",
          caption:
            "El archivo seleccionado debe contener al menos una fuente .cpp.",
        },
      },
      step2: {
        title: "Configura el análisis",
        description:
          "Selecciona el benchmark disponible, el tamaño de entrada, las repeticiones por punto y el perfil de ejecución que necesites.",
        profileShot: {
          alt: "Selección del entorno y del perfil de medición",
          caption: "El perfil controla cuántas veces se repite cada punto.",
        },
        summaryShot: {
          alt: "Resumen completo del experimento listo para revisar y ejecutar",
          caption:
            "El resumen permite comprobar los parámetros antes de ejecutar el experimento.",
        },
      },
      step3: {
        title: "Envía y sigue la ejecución",
        description:
          "Después de confirmar la configuración, el trabajo entra a la cola y avanza por estados controlados mientras se compila, ejecuta, mide y procesa.",
        overviewShot: {
          alt: "Vista de una ejecución registrada y en cola",
          caption:
            "La etapa activa se distingue del trabajo ya completado.",
        },
        detailsShot: {
          alt:
            "Vista de una ejecución realizando mediciones y mostrando detalles técnicos",
          caption:
            "Los detalles técnicos permiten seguir los mensajes del proceso.",
        },
      },
      step4: {
        title: "Interpreta los resultados",
        description:
          "Cuando la ejecución finaliza, revisa las métricas disponibles, sus gráficos y las explicaciones que ayudan a interpretar el comportamiento observado.",
        shot: {
          alt:
            "Resumen de una ejecución completada con indicadores principales e interpretación guiada",
          caption:
            "La cabecera conserva la configuración y resume el último punto medido.",
        },
      },
    },
    zip: {
      kicker: "Antes de ejecutar",
      title: "Prepara correctamente el ZIP",
      description:
        "El archivo comprimido debe contener el código fuente que deseas medir. La plataforma valida el ZIP antes de registrar el experimento para evitar formatos inesperados o archivos que no puedan procesarse.",
      exampleAria: "Ejemplo de ZIP",
      note:
        "No incluyas rutas absolutas, enlaces simbólicos ni contenido ajeno a la prueba. Si el ZIP no cumple las validaciones, el sistema lo rechazará antes de ejecutar el experimento.",
    },
    configuration: {
      kicker: "Configuración",
      title: "Qué controla cada parámetro",
      benchmark:
        "Define el tipo de entrada y el escenario con el que se evaluará el código.",
      inputSizeLabel: "Tamaño de entrada",
      inputSize:
        "Determina la escala del problema utilizado durante la medición.",
      repetitionsLabel: "Repeticiones por punto",
      repetitions:
        "Indica cuántas veces se mide cada tamaño de entrada para obtener resultados más estables.",
      profileLabel: "Perfil",
      profile:
        "Agrupa configuraciones de ejecución pensadas para análisis rápidos, balanceados o más exhaustivos.",
    },
    examples: {
      kicker: "Ejemplos para comenzar",
      title: "Algoritmos clásicos listos para medir",
      description:
        "Descarga un ZIP, revisa su código y súbelo desde Nuevo análisis. Cada ejemplo respeta el contrato de entrada de su benchmark y está pensado para producir una tendencia interpretable.",
      observeLabel: "Qué observar",
      download: "Descargar ejemplo {{benchmark}}",
      sizeNote:
        "El ejemplo SIZE contiene dos archivos .cpp. Performance System los registra como implementaciones independientes dentro del mismo experimento, por lo que después puedes compararlas sin mezclar sus mediciones.",
      size: {
        title: "Insertion Sort vs. Merge Sort",
        description:
          "Dos algoritmos clásicos de ordenamiento reciben exactamente el mismo tamaño N y generan el mismo conjunto determinista de datos.",
        observe:
          "Compara cómo cambian tiempo e instrucciones al crecer N y, después, abre la comparación entre ambas implementaciones.",
      },
      lcs: {
        title: "Longest Common Subsequence",
        description:
          "Implementación clásica por programación dinámica sobre dos secuencias formadas a partir de las líneas del archivo de texto entregado por el benchmark.",
        observe:
          "Observa el crecimiento del trabajo al aumentar la cantidad de líneas procesadas y relaciona la tendencia con la tabla dinámica.",
      },
      camm: {
        title: "Multiplicación de matrices por bloques",
        description:
          "Multiplicación clásica de matrices organizada en bloques para trabajar sobre los valores numéricos que el benchmark entrega por argumentos.",
        observe:
          "Revisa tiempo, instrucciones y métricas de caché disponibles mientras aumenta la cantidad de valores de entrada.",
      },
    },
    states: {
      kicker: "Seguimiento",
      title: "Estados de una ejecución",
      description:
        "La ejecución mantiene un estado persistente para que puedas abandonar la vista y volver a consultar su progreso.",
      items: {
        queued: {
          name: "En cola",
          description:
            "La ejecución fue registrada y espera un recurso de medición.",
        },
        running: {
          name: "En ejecución",
          description:
            "El código se compila y/o ejecuta en el entorno de medición.",
        },
        processing: {
          name: "Procesando",
          description:
            "Performance System transforma las mediciones en resultados consultables.",
        },
        completed: {
          name: "Completado",
          description:
            "Los resultados están disponibles para revisión.",
        },
      },
      failure: {
        title: "¿Y si algo falla?",
        description:
          "Los errores de validación, compilación, ejecución, medición o procesamiento se presentan como un fallo de la ejecución. El detalle disponible ayuda a distinguir la etapa que requiere corrección.",
      },
    },
    continuity: {
      kicker: "Continuidad",
      title: "Retoma tu último resultado desde el perfil",
      description:
        "La ejecución queda persistida aunque abandones la pantalla de seguimiento. En tu perfil puedes consultar el estado de tu actividad y abrir directamente el resultado más reciente.",
      lastResultLabel: "Ver último resultado",
      lastResultDescription:
        "abre la visualización de la ejecución completada más reciente; no vuelve a ejecutar el código ni altera las mediciones guardadas.",
      shot: {
        alt:
          "Perfil del estudiante con resumen de actividad y acceso al último resultado",
        caption:
          "El acceso se encuentra en la tarjeta Ejecución más reciente.",
      },
    },
    results: {
      kicker: "Resultados",
      title: "Qué puedes observar",
      description:
        "La disponibilidad exacta depende de la ejecución, del perfil y del hardware de medición. Performance System muestra únicamente las métricas que realmente están disponibles.",
      metrics: {
        time: {
          title: "Tiempo",
          text:
            "Permite observar cuánto tarda la implementación bajo la configuración seleccionada.",
        },
        cpu: {
          title: "CPU",
          text:
            "Incluye eventos y contadores de procesador disponibles para estudiar el trabajo realizado por el algoritmo.",
        },
        memory: {
          title: "Memoria",
          text:
            "Ayuda a contextualizar el uso de recursos y el comportamiento de la implementación.",
        },
        energy: {
          title: "Energía",
          text:
            "Se muestra cuando el hardware y el entorno de medición permiten obtenerla de forma confiable.",
        },
      },
      example: {
        kicker: "Ejemplo de lectura",
        title: "Relaciona el tamaño de entrada con la tendencia",
        description:
          "En este ejemplo, el eje horizontal representa el tamaño de entrada y el vertical el tiempo de ejecución. Cada punto resume las repeticiones realizadas para ese tamaño: interesa la dirección general de la serie, no un punto aislado.",
        points: {
          unit: "Comprueba siempre la unidad indicada en cada eje.",
          trend:
            "Observa si la métrica crece, disminuye o se mantiene.",
          compare:
            "Compara solo ejecuciones con condiciones equivalentes.",
        },
        shot: {
          alt: "Gráfico de tiempo de ejecución según tamaño de entrada",
          caption:
            "La serie muestra una tendencia creciente entre los tamaños medidos.",
        },
      },
    },
    interpretation: {
      kicker: "Interpretación",
      title: "Cómo leer una medición",
      description:
        "Un gráfico no debe analizarse de forma aislada. Observa la tendencia, compara ejecuciones bajo condiciones equivalentes y utiliza las explicaciones del sistema como apoyo para relacionar las métricas con el comportamiento del algoritmo.",
      preview: {
        trend: "Tendencia observada",
        metrics: "Comparación entre métricas",
        implementation: "Contexto de la implementación",
      },
    },
    goodPractices: {
      kicker: "Buenas prácticas",
      title: "Obtén resultados comparables",
      items: {
        sameConfig:
          "Compara implementaciones usando la misma configuración de entrada y número de repeticiones.",
        externalProcesses:
          "Evita procesos externos innecesarios durante una medición cuando estés trabajando en un entorno local de pruebas.",
        repetitions:
          "Usa varias repeticiones por punto para reducir el efecto de variaciones puntuales.",
        jointInterpretation:
          "Interpreta las métricas en conjunto: una mejora en una métrica no implica necesariamente una mejora global.",
      },
    },
    final: {
      kicker: "Antes de comenzar",
      title: "Revisa el ZIP y conserva condiciones comparables",
      description:
        "Con el archivo preparado, configura el benchmark y comprueba el resumen antes de ejecutar. Cuando necesites repetir una comparación, mantén el mismo entorno, perfil y tamaño de entrada para que la lectura siga siendo válida.",
    },
    lightbox: {
      aria: "Captura ampliada del tutorial",
      closeAria: "Cerrar captura ampliada",
    },
  },
};

export default es;
