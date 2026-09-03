const en = {
  common: {
    user: "User",
    executionCount: {
      one: "{{count}} execution",
      other: "{{count}} executions",
    },
  },
  language: {
    selectorLabel: "Language",
    spanish: "Spanish",
    english: "English",
    switchTo: "Switch language to {{language}}",
  },
  nav: {
    newAnalysis: "New analysis",
    history: "History",
    protocols: "Protocols",
    tutorial: "How it works",
    supervision: "Supervision",
    administration: "Administration",
  },
  protocols: {
    states: {
      draft: "Draft",
      published: "Published",
      inactive: "Inactive",
    },
    actions: {
      create: "Create protocol",
      edit: "Edit",
      close: "Close",
      save: "Save",
      saving: "Saving…",
      publish: "Publish",
      deactivate: "Deactivate",
      retry: "Retry",
    },
    fields: {
      title: "Title",
      objective: "Objective",
      instructions: "Instructions",
      optional: "(optional)",
      benchmark: "Benchmark",
      inputSize: "Input size",
      profile: "Measurement profile",
      samples: "Repetitions",
      distribution: "CAMM distribution",
    },
    profiles: {
      quick: "Quick",
      balanced: "Balanced",
      exhaustive: "Exhaustive",
      custom: "Custom",
    },
    teacher: {
      title: "Experimental protocols",
      description:
        "Define reusable experimental configurations to guide analyses in this course.",
      createTitle: "New protocol",
      editTitle: "Edit protocol",
      loading: "Loading protocols",
      loadErrorTitle: "We could not load the protocols",
      emptyTitle: "This course has no protocols yet.",
      emptyText:
        "Create a draft and publish it when you want students to see it.",
      listAria: "Course experimental protocols",
      instructions: "View instructions",
      courseInactive:
        "The course is inactive. You can review or edit existing protocols, but you cannot create or publish new ones.",
      policyLoading:
        "Loading the AUTO operational policy…",
      policyLimits:
        "Current AUTO policy: range {{min}}–{{max}}, initial value {{defaultValue}}, recommended up to {{recommended}}.",
      policyUnavailable:
        "The AUTO operational policy is unavailable. You can review existing protocols, but you cannot create or save configurations until it recovers.",
      errors: {
        load: "The course protocols could not be loaded.",
        policy:
          "The AUTO operational policy is unavailable. Try again when the measurement environment recovers.",
        save: "The protocol could not be saved.",
        action: "The protocol state could not be updated.",
      },
    },
    student: {
      eyebrow: "Academic context",
      title: "Protocols",
      description:
        "Review experimental configurations published in your active courses and prepare an analysis from them.",
      loading: "Loading protocols",
      loadErrorTitle: "We could not load your protocols",
      emptyTitle: "You have no published protocols.",
      emptyText:
        "When a teacher publishes a protocol in one of your active courses, it will appear here.",
      personalAnalysis: "Start personal analysis",
      listAria: "Available protocols",
      courseFallback: "Course",
      instructions: "View instructions",
      prepareAnalysis: "Prepare analysis",
      errors: {
        load: "Your available protocols could not be loaded.",
      },
    },
  },
  protocolOnboarding: {
    loaded:
      "Protocol prepared: {{title}}. The configuration remains editable; attach your ZIP to continue.",
    detached:
      "You changed the course. The analysis will no longer be associated with the original protocol.",
    errors: {
      invalid:
        "The protocol does not contain a valid configuration for this analysis.",
      session:
        "Your session expired while the protocol was loading.",
      forbidden:
        "This protocol is not available to your account.",
      notFound:
        "The protocol is no longer available.",
      generic:
        "The analysis could not be prepared from this protocol.",
    },
  },
  notifications: {
    eyebrow: "Activity",
    title: "Notifications",
    open: "Open notifications",
    unreadCount: "{{count}} unread notifications",
    loading: "Loading notifications…",
    empty: "You have no notifications.",
    error: "Notifications could not be loaded.",
    retry: "Retry",
    readAll: "Mark all as read",
    kinds: {
      executionFailed: {
        title: "Execution failed",
        description:
          "{{experiment}} finished with an error ({{code}}).",
      },
      teacherFeedback: {
        title: "New teacher feedback",
        description:
          "{{actor}} left feedback on {{experiment}}.",
      },
      protocolPublished: {
        title: "New protocol available",
        description:
          "{{protocol}} was published in {{course}}.",
      },
      generic: {
        title: "New activity",
        description: "An update is available.",
      },
    },
    fallbacks: {
      experiment: "Experiment",
      teacher: "Teacher",
      protocol: "Protocol",
      course: "Course",
      error: "ERROR",
    },
  },
  teacherFeedback: {
    eyebrow: "Academic supervision",
    title: "Teacher feedback",
    description:
      "Brief teacher comments about this experiment. This is not a grade or a conversation thread.",
    loading: "Loading feedback…",
    empty: "There is no teacher feedback for this experiment yet.",
    timelineAria: "Teacher feedback history",
    actions: {
      retry: "Retry",
      send: "Publish feedback",
      sending: "Publishing…",
    },
    composer: {
      label: "New feedback",
      placeholder:
        "Write a concrete observation about the experiment or its results.",
      characters: "{{count}} / {{max}} characters",
    },
    errors: {
      load: "Teacher feedback could not be loaded.",
      send: "Teacher feedback could not be published.",
    },
    fallbacks: {
      author: "Teacher",
      date: "Date unavailable",
    },
  },
  roles: {
    admin: "Administrator",
    teacher: "Teacher",
    student: "Student",
  },
  navbar: {
    brandAria: "Performance System — New analysis",
    mainNavigationAria: "Main navigation",
    mobileNavigationAria: "Mobile navigation",
    themeToLight: "Switch to light theme",
    themeToDark: "Switch to dark theme",
    profile: "My profile",
    logout: "Sign out",
    openNavigation: "Open navigation",
    closeNavigation: "Close navigation",
  },
  login: {
    logoAlt: "Performance System logo",
    brandSubtitle:
      "A platform for measuring and analyzing C and C++ code performance using real hardware metrics.",
    highlights: {
      analysisLead: "Performance analysis for",
      benchmarks: "LCS, CAMM and SIZE",
      metricsLead: "Advanced metrics:",
      metrics: "IPC, cache, energy, cycles",
      integrationLead: "Google authentication with account-based authorization",
      accounts: "institutional and preauthorized external access",
    },
    note: {
      inf:
        "@inf.udec.cl accounts have direct institutional access. If an account was preauthorized beforehand, its assigned role is preserved.",
      udec:
        "@udec.cl accounts can sign in if they were already preauthorized or request access through the UdeC form on this page.",
      external:
        "External accounts require prior administrator authorization and must use the exact authorized email.",
    },
    title: "Access to Performance System",
    subtitle: {
      inf:
        "@inf.udec.cl: direct institutional access.",
      udec:
        "@udec.cl: previously authorized access or a UdeC access request.",
      external:
        "External email: access only when preauthorized by the administrator.",
    },
    google: {
      redirecting: "Redirecting to Google...",
      continue: "Continue with Google",
      hint:
        "Google authenticates your identity. Performance System authorizes access according to the exact email and account status.",
    },
    accessRequestDivider: "UdeC access request",
    fields: {
      fullName: "Full name",
      fullNamePlaceholder: "First name Last name",
      institutionalEmail: "UdeC institutional email",
      professorEmail: "Responsible professor's email",
      professorEmailPlaceholder: "profesor@inf.udec.cl",
      course: "Course / Subject",
      coursePlaceholder: "E.g. INF-253 Data Structures",
      comment: "Comment",
      commentPlaceholder:
        "Briefly explain why you need access (2–3 lines).",
      optional: "optional",
    },
    validation: {
      fullNameRequired: "Full name is required.",
      emailRequired: "Institutional email is required.",
      emailDomain:
        "This form is only for institutional @udec.cl email addresses.",
      professorRequired:
        "Enter the responsible professor's email.",
      professorInvalid:
        "Enter a valid UdeC institutional email for the professor.",
    },
    request: {
      scope:
        "This public form is only for @udec.cl accounts. External accounts must be enabled in advance by the administrator.",
      submit: "Submit access request",
      submitting: "Submitting request...",
      success:
        "Request submitted successfully. You will receive an email when it is approved. Then you can sign in with 'Continue with Google' using this same institutional email.",
      pending:
        "An access request is already pending for this email.",
      emailRejected:
        "The institutional email could not be validated. Review it and try again.",
      professorRejected:
        "The responsible professor's email could not be validated. Review it and try again.",
      error:
        "An error occurred while submitting the request. Try again.",
      metaLead:
        "When you submit this request, an administrator will review your case. Once your account is approved, you can sign in using",
      metaSuffix:
        "with the same email",
    },
    footer: {
      lead:
        "Having trouble accessing the system? Contact the course instructor or the laboratory administrator",
      example: "(jfuentess@inf.udec.cl).",
    },
    auth: {
      generic:
        "The sign-in process could not be completed. Try again.",
      invalidOauthState:
        "The sign-in request expired or is invalid. Try again.",
      googleAuthError:
        "The Google sign-in process could not be completed.",
      missingAuthCode:
        "Google did not provide the information required to sign in.",
      missingIdToken:
        "Your identity could not be validated with Google.",
      externalDomain:
        "This email address is not enabled for sign-in.",
      externalAccessRequired:
        "This email address is not enabled. External access requires a prior invitation or authorization from the administrator.",
      accessRequired:
        "Your email requires an access request before you can sign in.",
      accessPending:
        "Your access request is still pending approval.",
      accountDisabled:
        "Your account is disabled. Contact the system administrator.",
      accessDenied:
        "Access could not be authorized for this account.",
    },
  },

  history: {
    eyebrow: "Saved work",
    title: "History",
    description: "Return to previous experiments, executions, results, and their traceability.",
    newAnalysis: "New analysis",
    filtersAria: "History filters",
    filtersTitle: "Filter experiments",
    filtersHint: "Filters are applied to your full history before results are paginated.",
    clearFilters: "Clear filters",
    search: "Search",
    searchHint: "Title, ZIP file, .c/.cpp source, or note",
    searchPlaceholder: "E.g. sorting, sorting.zip, merge.c, baseline reference",
    referencesOnly: "References only",
    archivedOnly: "Archived only",
    archiveHint: "Archiving only organizes your history; it does not delete the experiment or its results.",
    archived: "Archived",
    archive: "Archive",
    restore: "Restore",
    updating: "Updating…",
    status: "Status",
    filterByStatus: "Filter by status",
    allStatuses: "All statuses",
    benchmark: "Benchmark",
    filterByBenchmark: "Filter by benchmark",
    allBenchmarks: "All benchmarks",
    context: "Context",
    filterByCourse: "Filter by course",
    allContexts: "All contexts",
    personal: "Personal",
    summaryAria: "History summary",
    resultsFound: "Results found",
    registeredExperiments: "Registered experiments",
    page: "Page",
    of: "of",
    loadingTitle: "Loading history",
    loadingText: "Loading your saved experiments.",
    loadErrorTitle: "We could not load your history",
    retry: "Retry",
    emptyFilteredTitle: "No experiments found",
    emptyTitle: "You do not have any registered experiments yet",
    emptyFilteredText: "Try different criteria or clear the filters to view your full history again.",
    emptyText: "Once you run an analysis, it will appear here so you can review it later.",
    createFirstAnalysis: "Create first analysis",
    experimentsAria: "Experiments",
    experimentNumber: "Experiment #{{id}}",
    untitledExperiment: "Untitled experiment",
    reference: "Reference",
    file: "File",
    zipUnavailable: "ZIP unavailable",
    lastActivity: "Last activity",
    registeredProvenance: "Registered measurement provenance",
    measurementNode: "Measurement node",
    registeredHardwareProfile: "Registered hardware profile",
    implementations: "Implementations",
    language: "Language",
    languageUnavailable: "Not reported",
    sources: "Sources",
    sourcesUnavailable: "Sources unavailable",
    moreSources: "+{{count}} more",
    benchmarkUnavailable: "Benchmark not provided",
    viewExperiment: "View experiment",
    paginationAria: "History pagination",
    previous: "Previous",
    next: "Next",
    noRecord: "No record",
    noCourse: "No associated course",
    semester: "Semester",
    states: {
      empty: "No executions",
      inProgress: "In progress",
      completed: "Completed",
      partial: "Partial",
      failed: "Failed",
      cancelled: "Cancelled",
    },
    errors: {
      load: "Your history could not be loaded.",
      incomplete: "The server returned incomplete history data.",
      filterOptions: "History course options could not be loaded.",
      archive: "The experiment archive state could not be updated.",
    },
  },

  profile: {
    semester: "Semester",
    noPeriod: "Period unavailable",
    courseFallback: "Course",
    unnamedCourse: "Unnamed course",
    teacherUnavailable: "Professor unavailable",
    period: "Period",
    professor: "Professor",
    newAnalysisInCourse: "New analysis in this course",
    loadingTitle: "Loading your profile",
    loadingText: "Loading activity and execution summary.",
    eyebrow: "My profile",
    loadErrorTitle: "We could not load your information",
    retry: "Retry",
    accountEyebrow: "Personal account",
    title: "My profile",
    description:
      "Review your institutional identity and a summary of the activity recorded in Performance System.",
    newAnalysis: "New analysis",
    noEmail: "No registered email",
    accountCreated: "Account created",
    lastSession: "Last session",
    lastExecution: "Last execution",
    academicContext: "Academic context",
    coursesTitle: "Courses for my analyses",
    coursesDescription:
      "Active courses where you can associate new experiments.",
    coursesLoadingTitle: "Loading your courses",
    coursesLoadingText: "Loading your active academic context.",
    coursesLoadErrorTitle: "We could not load your courses",
    retryCourses: "Retry courses",
    noCoursesTitle: "You currently have no active courses.",
    noCoursesText:
      "You can run a personal analysis without associating it with a course.",
    startPersonalAnalysis: "Start personal analysis",
    activity: "Activity",
    usageSummary: "Usage summary",
    usageDescription:
      "These figures are calculated from your persisted experiments and executions.",
    metrics: {
      submissions: "Experiments",
      submissionsHint: "Registered experiments",
      executions: "Executions",
      executionsHint: "Total executions",
      completed: "Completed",
      completedHint: "Processing completed",
      failed: "Failed",
      failedHint: "Recorded failures",
    },
    executionsEyebrow: "Executions",
    currentState: "Current status",
    active: "Active",
    queued: "Queued",
    running: "Running",
    processing: "Processing",
    cancelled: "Cancelled",
    latestActivity: "Latest activity",
    latestExecution: "Most recent execution",
    status: "Status",
    date: "Date",
    duration: "Duration",
    viewExperiment: "View experiment",
    viewLastResult: "View latest result",
    viewFullHistory: "View full history",
    noFinalResult:
      "The most recent execution does not have a final result available yet.",
    firstAnalysisState:
      "Once you complete your first analysis, its status will appear here.",
    institutionalData: "Institutional data",
    institutionalDataText:
      "The displayed name, email, and role come from your account registered in the system. They cannot be edited on this page.",
    noRecord: "No record",
    noData: "No data",
    accountStatus: {
      active: "Active",
      inactive: "Inactive",
    },
    roles: {
      admin: "Administrator",
      teacher: "Teacher",
      student: "Student",
      user: "User",
    },
    executionStates: {
      none: "No executions",
      queued: "Queued",
      running: "Running",
      processing: "Processing",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
      unavailable: "Unavailable",
    },
    errors: {
      load: "Your profile could not be loaded.",
      incomplete: "The server returned incomplete profile data.",
      courses: "Your active courses could not be loaded.",
    },
  },

  renderForm: {
    header: {
      eyebrow: "Performance experiment",
      exampleLink: "Need an example? View code examples",
    },
    upload: {
      testNameLabel: "Test name",
      testNamePlaceholder: "E.g. optimized LCS, blocked CAMM, etc.",
      testNameHelp:
        "This name identifies the Experiment. Each .c or .cpp file in the ZIP creates an independent execution.",
      noteLabel: "Personal note",
      optional: "(optional)",
      notePrivate: "Only you can see this note.",
      characters: "{{count}} / {{max}} characters",
      archiveLabel: "Code archive (.zip)",
      selectAria: "Select ZIP code archive",
      dropTitle: "Drag and drop the .zip here",
      dropHint: "or click to select a file from your computer.",
      maxHint:
        "Recommended max: {{max}} MB. The ZIP must contain at least one .c or .cpp file.",
      inspecting: "Analyzing contents…",
      cppFiles: {
        one: "{{count}} C/C++ source",
        other: "{{count}} C/C++ sources",
      },
      sourceSummary: {
        one: "{{count}} source · {{c}} C · {{cpp}} C++",
        other: "{{count}} sources · {{c}} C · {{cpp}} C++",
      },
      examplesInside: "Examples inside the .zip:",
    },
    measurement: {
      environmentLabel: "Execution environment",
      environmentName: "Multi-node measurement pool",
      automaticBadge: "AUTO",
      environmentDescription:
        "In AUTO mode, the system selects an eligible node from the serial multi-node execution pool. Only one physical measurement remains active at a time.",
      environmentNote:
        "Once a submission is assigned, its executions retain affinity with that node. Hardware provenance is recorded to preserve traceability and support comparability.",
      targetHelp:
        "AUTO is the recommended option. PINNED explicitly fixes an available node for a controlled execution.",
      nodeModeGroupAria: "Measurement node selection mode",
      autoModeAria: "Use automatic node selection",
      pinnedModeAria: "Pin a measurement node",
      pinnedModeTitle: "Pin measurement node",
      pinnedModeBadge: "Advanced",
      pinnedModeHelp:
        "Explicitly selects an available node. Use it only when you need to control the physical provenance of the experiment.",
      nodeLoading: "Loading available nodes…",
      nodeLoadError:
        "Available nodes for advanced selection could not be loaded.",
      nodeRetry: "Retry nodes",
      availabilityChecking:
        "Checking measurement-environment availability…",
      availabilityReady:
        "The measurement environment is available for new executions.",
      availabilityUnavailable:
        "No measurement node is operational right now. Try again later or contact the system owner.",
      availabilityRetry: "Retry availability",
      noNodes:
        "No nodes are available for a new PINNED selection. You can return to AUTO.",
      nodeLabel: "Measurement node",
      nodePlaceholder: "Select a node…",
      validationOnly: "Validation",
      nodeProfile: "Hardware profile: {{profile}}",
      pinnedNoFallback:
        "PINNED retains affinity with this node and does not silently migrate to another node if it becomes unavailable.",
      profileLabel: "Measurement profile",
      profileHelp:
        "Defines how many times each measurement point is repeated. More repetitions usually provide more stable results, but increase the total experiment time.",
      repetitions: {
        one: "{{count}} repetition per point",
        other: "{{count}} repetitions per point",
      },
      manualRepetitions: "Repetitions defined manually",
      profiles: {
        rapido: {
          name: "Quick",
          badge: "Exploration",
          description:
            "Useful for quickly checking general behavior before running a more extensive measurement.",
        },
        equilibrado: {
          name: "Balanced",
          badge: "Recommended",
          description:
            "Balances execution time and measurement stability. This is the recommended option for general use.",
        },
        exhaustivo: {
          name: "Exhaustive",
          badge: "Higher stability",
          description:
            "Increases repetitions to observe measurement variability with greater stability.",
        },
        personalizado: {
          name: "Custom",
          badge: "Manual control",
          description:
            "Lets you define the number of repetitions per measurement point manually.",
        },
      },
    },
    benchmark: {
      sectionLabel: "Benchmark type and parameters",
      contextHelp: {
        title: "Benchmark quick guide",
        lcs: "Text input: uses the text dataset managed by the system.",
        camm: "Numerical data: generates numerical inputs and lets you choose their distribution.",
        size: "Parameterized size: passes N as an integer argument; the program manages its data from that value.",
      },
      sectionHelp:
        "Select the input type that best represents the algorithm you want to analyze. Performance System will use the associated benchmark to generate the measurement points.",
      policyNeutral:
        "Select a benchmark to load the applicable operational limits.",
      maxInput: "Maximum input size",
      repetitionsPerPoint: "Repetitions per measurement point",
      decreaseRepetitions: "Decrease repetitions",
      increaseRepetitions: "Increase repetitions",
      currentProfile:
        "The current profile is {{profile}}. Values 10, 30, and 50 map to Quick, Balanced, and Exhaustive; other values are recorded as Custom.",
      fixedByProfile: "Defined by the {{profile}} profile.",
      customProfileHelp:
        "The Custom profile lets you choose from 1 to 100 repetitions per point.",
      repetitionsSlider: "Repetitions per point",
      allowedRange:
        "Allowed range: {{min}}–{{max}}. This is an acceptance limit, not a guarantee of execution time.",
      policyContractLabel: "Effective operational policy",
      minimumInput: "Minimum",
      defaultInput: "Default",
      recommendedMaxInput: "Recommended maximum",
      hardMaxInput: "Absolute maximum",
      inputStep: "Step",
      operationalTimeout: "Operational timeout",
      timeoutValueMinutes:
        "{{seconds}} s · {{minutes}} min",
      timeoutValueSeconds:
        "{{seconds}} s",
      hardMaxHelp:
        "The absolute maximum ({{hardMax}}) is the parameter acceptance limit; it does not guarantee that the benchmark will complete successfully.",
      timeoutHelp:
        "The operational timeout is the maximum time allowed for this execution; it is not an estimated duration (ETA).",
      recommendedValues: "Suggested values",
      advancedInputTitle: "Advanced input size",
      advancedInputWarning:
        "This is above the recommended maximum ({{recommendedMax}}) but remains within the absolute maximum ({{hardMax}}). This is an advanced range: it may take a long time or reach the operational timeout depending on the implementation.",
      dataDistribution: "Data distribution",
      dataDistributionHelp:
        "Defines how the numeric dataset received by the algorithm is organized.",
      executionSummary: {
        one: "How it will run: the engine will generate several measurement points up to the selected maximum size and repeat each point {{count}} time.",
        other: "How it will run: the engine will generate several measurement points up to the selected maximum size and repeat each point {{count}} times.",
      },
      notApplicable: "Not applicable",
      tasks: {
        lcs: {
          name: "Text input",
          subtitle:
            "Analyzes algorithms that process text using the english.50MB dataset.",
          description:
            "The engine evaluates the program with increasing input sizes taken from the text dataset. Each point is repeated according to the selected measurement profile.",
          badge: "Text dataset",
          inputHelp:
            "Maximum number of text lines the benchmark will reach.",
        },
        camm: {
          name: "Numeric data",
          subtitle:
            "Analyzes algorithms over numeric collections with different distributions.",
          description:
            "The engine evaluates the program with numeric datasets of increasing size. You can choose the data distribution to study how it affects algorithm behavior.",
          badge: "Numeric dataset",
          inputHelp:
            "Maximum number of numeric values the benchmark will reach.",
        },
        size: {
          name: "Parameterized size",
          subtitle:
            "Analyzes algorithms whose problem size is provided as an integer argument.",
          description:
            "The engine runs the program with increasing input-parameter values. This is useful when the algorithm generates or manages its data from a size received as an argument.",
          badge: "Integer argument",
          inputHelp:
            "Maximum value passed to the program as the problem size.",
        },
      },
      dataTypes: {
        cammr: "Random numbers",
        cammso: "Semi-sorted numbers",
        camms: "Equal numbers",
      },
    },
    course: {
      context: "Academic context",
      noCourse: "No associated course",
      personal: "Personal",
      noActiveCourses:
        "You have no active courses available to associate with this analysis. You can continue with a personal analysis.",
      course: "Course",
      loading: "Loading…",
      loadingText: "Loading courses available for this analysis.",
      loadError: "We could not load your courses",
      retry: "Retry",
      associatedCourse: "Associated course",
      automatic: "Automatic",
      professor: "Professor: {{name}}",
      professorUnavailable: "Professor unavailable",
      automaticAssociation:
        "This experiment will automatically be associated with your only active course.",
      selectCourse: "Select the course",
      optionalAssociation: "Optional academic association",
      required: "Required",
      optional: "Optional",
      deliveryCourse: "Course for this experiment",
      selectPlaceholder: "Select a course…",
      personalOption: "Personal · No associated course",
      multipleCoursesHelp:
        "You have more than one active course. Selecting one prevents experiments from different courses or terms from being mixed.",
      optionalCoursesHelp:
        "You can keep this analysis personal or explicitly associate it with one of your active courses.",
    },
    overview: {
      title: "Review experiment",
      description:
        "Confirm the configuration before sending the code to the execution environment.",
      experiment: "Experiment",
      name: "Name",
      unnamed: "(unnamed)",
      file: "File",
      noFile: "No file selected",
      implementations: "Implementations / C/C++ sources",
      sources: "Included sources",
      moreSources: {
        one: "+{{count}} more",
        other: "+{{count}} more",
      },
      benchmark: "Benchmark",
      parameters: "Parameters",
      maxSize: "Maximum size",
      range: "range {{min}}–{{max}}",
      repetitions: "Repetitions per point",
      dataDistribution: "Data distribution",
      measurement: "Measurement",
      environment: "Environment",
      selectionMode: "Selection mode",
      autoMode: "AUTO · automatic selection",
      pinnedMode: "PINNED · fixed node",
      node: "Node",
      autoNodePending:
        "A node will be assigned automatically from the eligible pool when the execution is registered.",
      registeredHardwareProfile:
        "Registered hardware profile",
      profile: "Profile",
      effectivePolicy: "Effective operational policy",
      minimumInput: "Minimum",
      defaultInput: "Default",
      recommendedMaxInput: "Recommended maximum",
      hardMaxInput: "Absolute maximum",
      inputStep: "Step",
      operationalTimeout: "Operational timeout",
      timeoutValueMinutes:
        "{{seconds}} s · {{minutes}} min",
      timeoutValueSeconds: "{{seconds}} s",
      advancedInput:
        "Advanced input: {{input}} exceeds the recommended maximum of {{recommended}}, but remains within the absolute maximum of {{hardMax}}.",
      hardMaxHelp:
        "The absolute maximum ({{hardMax}}) is an acceptance limit; it does not guarantee that the benchmark will complete successfully.",
      timeoutHelp:
        "The operational timeout is the maximum execution time allowed. It is not an estimate of how long the experiment will take (ETA).",
      course: "Course",
      noCourse: "No associated course",
      user: "User",
      authenticatedSession: "Authenticated session",
      back: "Back to edit",
      sending: "Sending…",
      confirm: "Confirm and run",
    },

    workflow: {
      zip: {
        extension: "The file must have a .zip extension.",
        tooLarge:
          "The recommended maximum size is {{max}} MB. The current file is {{size}}.",
        noCpp:
          "The .zip contains no .c or .cpp sources. Review its contents before uploading it again.",
        noSource:
          "The ZIP must contain at least one .c or .cpp file.",
        unreadable:
          "The .zip contents could not be read. Try again or use another file.",
      },
      polling: {
        missingPersistentId:
          "The server did not return the persistent execution identifier.",
        unavailable: "The execution status could not be retrieved.",
        notFound: "The requested execution is no longer available.",
      },
      ready: {
        kicker: "Summary",
        title: "Experiment summary",
        description:
          "Review the main configuration before starting the analysis.",
        readyTitle: "Configuration ready",
        pendingTitle: "Configuration pending",
        readyText:
          "You can review the detailed summary and confirm the execution.",
        pendingText:
          "Complete these requirements to enable review:",
        requirements: {
          zipRequired: "Select a ZIP archive.",
          zipInspecting: "Wait while the ZIP archive is validated.",
          zipInvalid: "Select a valid ZIP archive containing at least one .c or .cpp file.",
          benchmarkRequired: "Choose a benchmark.",
          inputSizeInvalid: "Enter a valid maximum input size.",
          samplesInvalid:
            "Choose between 1 and 100 repetitions for the Custom profile.",
          dataTypeRequired: "Select the data distribution for CAMM.",
          courseLoading: "Wait while your academic context loads.",
          courseUnavailable:
            "Retry loading the academic context before continuing.",
          courseRequired: "Select the course for this experiment.",
          measurementNodeRequired:
            "Select a measurement node or return to AUTO mode.",
          measurementPolicyLoading:
            "Wait while the measurement policy is loaded.",
          measurementPolicyUnavailable:
            "The measurement policy is unavailable. Reload the page or try again.",
          measurementUnavailable:
            "No measurement node is available to accept a new execution. Retry availability before continuing.",
        },
        review: "Review and run",
        clear: "Clear configuration",
        hint:
          "Before sending the code, you will see the detailed summary to confirm the parameters.",
      },
      submitting: {
        kicker: "Starting",
        title: "Submitting analysis",
        description: "The experiment is being registered on the server.",
        registering: "Registering request",
        hint: "This step usually takes only a few seconds.",
      },
      running: {
        kicker: "Running",
        title: "Analyzing your code",
        description:
          "The code is being prepared and measurements are running on the node.",
        chip: "In progress",
        prepareAnother: "Prepare another analysis",
        hint:
          "You can keep this view open while the benchmark runs. If you reload the page, Performance System will attempt to recover the execution.",
        prepareAnotherHint:
          "Preparing another analysis does not cancel this execution: it will remain queued or running and you can follow it from History.",
      },
      queue: {
        title: "FIFO position per execution",
        next: "Next in queue",
        ahead: {
          one: "{{count}} execution ahead",
          other: "{{count}} executions ahead",
        },
        explanation:
          "Measurements are dispatched in FIFO order. The position can change as other executions finish or are claimed.",
      },
      executionQueue: {
        next: "Next",
        position: "Position {{position}}",
      },
      executionList: {
        title: "Status by implementation",
        node: "Node: {{node}}",
        registeredProfile:
          "Registered profile: {{profile}}",
        progressAria:
          "Execution progress: {{name}}",
      },
      executionStates: {
        queued: "Queued",
        running: "Running analysis",
        processing: "Processing results",
        completed: "Results available",
        failed: "Error",
        cancelled: "Cancelled",
        unknown: "Status unavailable",
      },
      cancellation: {
        action: "Cancel execution",
        actionFor: "Cancel execution for {{name}}",
        pending: "Cancelling…",
        stateChanged:
          "The execution changed state before it could be cancelled.",
        network: "Could not connect to cancel the execution.",
        session: "Your session cannot cancel this execution.",
        error: "Could not cancel the execution. Try again.",
      },
      events: {
        accepted: "Request accepted.",
        queued: "Execution added to the FIFO queue.",
        running: "The measurement node started the execution.",
        processing: "Processing measurement results.",
        completed: "Results available.",
        failed: "The execution ended with an error.",
        failedWithMessage: "Execution failed: {{message}}",
        cancelled: "The execution was cancelled.",
      },
      completed: {
        kicker: "Completed",
        title: "Analysis completed",
        description: "The measurements were processed successfully.",
        chip: "Results ready",
        calloutTitle: "Results available",
        calloutText:
          "You can now review the metrics and visualizations generated for this experiment.",
        viewResults: "View results",
        newAnalysis: "New analysis",
      },
      partial: {
        kicker: "Partial",
        title: "Analysis partially completed",
        description:
          "Some implementations completed successfully while others require review.",
        chip: "Partial results",
        calloutTitle: "Results are available",
        calloutText:
          "You can review completed executions without repeating those that already finished successfully. The experiment will also show which implementation failed.",
        cancelledDescription:
          "Some implementations produced results while others were cancelled before starting.",
        cancelledCalloutTitle: "Results are available",
        cancelledCalloutText:
          "You can review the available results. Cancelled implementations did not produce results.",
        viewResults: "View available results",
        newAnalysis: "New analysis",
      },
      cancelled: {
        kicker: "Cancelled",
        title: "Analysis cancelled",
        description:
          "The executions were cancelled before measurement began.",
        chip: "Cancelled",
        newAnalysis: "New analysis",
      },
      error: {
        kicker: "Issue",
        title: "Could not complete",
        description:
          "The execution ended with a problem that requires review.",
        chip: "Review required",
        calloutTitle: "The analysis did not finish successfully",
        retryRequest: "Retry status request",
        reviewRetry: "Review and try again",
      },
      summary: {
        code: "Code",
        selectFile: "Select a .zip file",
        benchmark: "Benchmark",
        selectBenchmark: "Select a benchmark",
        maxSize: "Maximum size",
        repetitions: "Repetitions",
        profile: "Profile",
        environment: "Environment",
        data: "Data",
        sentCode: "Submitted code",
      },
      progress: {
        accepted: {
          label: "Request registered",
          description: "The server received the analysis request.",
        },
        queued: {
          label: "Queued",
          description: "The code is waiting for its execution turn.",
        },
        running: {
          label: "Running analysis",
          description:
            "The code is being prepared and measurements are running on the node.",
        },
        processing: {
          label: "Processing results",
          description: "The collected metrics are being consolidated.",
        },
        completed: {
          label: "Results available",
          description: "The analysis is ready to be reviewed.",
        },
      },
      technical: {
        title: "Technical details",
        noMessagesYet: " (no messages yet)",
        messageWithoutContent: "Message has no content",
        empty:
          "The server has not published any additional messages yet.",
      },
      friendlyErrors: {
        default:
          "Review the code and experiment configuration. Technical details may provide additional information.",
        compilation:
          "The code could not compile successfully. Review the compiler errors before running it again.",
        timeout:
          "The execution exceeded the maximum allowed time. Review the algorithm or use a smaller input configuration.",
        results:
          "The execution finished without generating the expected results. Review the technical details before trying again.",
        server:
          "The server reported a problem during execution. Review the technical details and correct the code or configuration.",
      },
    },

    page: {
      headerTitle: "New performance analysis",
      headerSubtitle:
        "Upload an implementation and configure how Performance System will evaluate its behavior.",
      configKicker: "Configuration",
      configTitle: "Prepare your experiment",
      configDescription:
        "Select the code, benchmark type, and measurement parameters. You will be able to review the full configuration before starting the execution.",
      inputSize: {
        lines: "{{count}} lines",
        values: "{{count}} values",
      },
      recoveredExecution: "Recovered execution",
      recoveredFiles: {
        one: "{{count}} file",
        other: "{{count}} files",
      },
      registeredEnvironment: "Registered environment",
      draft: {
        restored: "Your previous configuration was restored.",
        clear: "Clear draft",
      },
      repeat: {
        loaded:
          "Experiment #{{id}} was loaded for repetition. Review the configuration before running it.",
      },
      starter: {
        loaded:
          "Initial configuration prepared for {{benchmark}}. Attach the example ZIP or your own ZIP to continue.",
      },
      validations: {
        numberRequired: "Enter a numeric value.",
        numberInvalid: "Enter a valid number.",
        minimum: "Minimum allowed: {{min}}.",
        maximum: "Maximum allowed: {{max}}.",
      },
      alerts: {
        fileRequired: "Please upload a .zip file before continuing.",
        benchmarkRequired: "Select a test type before running.",
        fileError: "Fix the file error before running.",
        parameterError: "Fix the numeric parameters before running.",
        dataTypeRequired:
          "Select the CAMM data type before running.",
        courseLoading: "Wait while your academic context is loaded.",
        courseUnavailable:
          "The execution cannot start until your active courses are verified.",
        courseRequired:
          "Select the corresponding course before running.",
      },
      errors: {
        courses: "Your active courses could not be loaded.",
        coursesSession:
          "Your session expired. Sign in again to load your courses.",
        coursesForbidden:
          "You do not have permission to load your active courses.",
        restoreInvalid:
          "The saved execution could not be reconstructed.",
        restoreSession:
          "Your session expired. Sign in again to recover the execution.",
        restoreForbidden:
          "You do not have permission to recover this execution.",
        restoreNotFound:
          "The execution specified in the URL no longer exists.",
        restoreGeneric:
          "The execution could not be recovered from the server.",
        reuseInvalid:
          "The historical configuration could not be interpreted.",
        reuseSession:
          "Your session expired. Sign in again to reuse this configuration.",
        reuseForbidden:
          "You do not have permission to reuse this execution.",
        reuseNotFound:
          "The execution used as a reference no longer exists.",
        reuseGeneric:
          "The historical configuration could not be reused.",
        repeatInvalid:
          "The historical Experiment descriptor is invalid.",
        repeatSession:
          "Your session expired. Sign in again to repeat the Experiment.",
        repeatForbidden:
          "Only the owner can repeat this Experiment.",
        repeatUnavailable:
          "The verified historical ZIP is unavailable for repeating this Experiment.",
        repeatInconsistent:
          "The historical executions do not share a common configuration. You can reuse one execution configuration instead.",
        repeatArchive:
          "The historical ZIP did not pass the validation required for a new analysis.",
        repeatGeneric:
          "The Experiment could not be loaded for repetition.",
        submitNoExecutions:
          "The server registered the request but returned no queued executions.",
        submitNetwork:
          "The server could not be reached. Verify that the backend is available and try again.",
        submitSession:
          "Your session expired. Sign in again before submitting the analysis.",
        submitForbidden:
          "Your account does not have permission to register this analysis.",
        submitTooLarge:
          "The submitted file exceeds the size allowed by the server.",
        submitMeasurementUnavailable:
          "The measurement environment is currently unavailable. Your analysis was not registered. Try again later or contact the system owner.",
        submitGeneric:
          "The analysis could not be registered on the server. Try again.",
        resultsDestination:
          "The results destination for this execution could not be determined.",
      },
    },
  },

  academicBreadcrumbs: {
    navigationAria: "Breadcrumb",
    history: "History",
    administration: "Administration",
    users: "Users",
    supervision: "Supervision",
    course: "Course",
    courseNumber: "Course #{{id}}",
    profile: "My profile",
    experiment: "Experiment",
    experimentNumber: "Experiment #{{id}}",
    result: "Result",
    comparison: "Comparison",
  },
  sourceViewer: {
    unavailable: "Unavailable",
    fallbackSource: "Historical source",
    fallbackDownloadFilename: "source.txt",
    marker: "Source for this execution",
    readOnly: "Read-only historical view",
    closeAria: "Close code viewer",
    size: "Size",
    states: {
      loading: "Loading historical source…",
    },
    errors: {
      network:
        "We could not connect to the server to retrieve the source.",
      session:
        "Your session does not allow access to this historical source.",
      notFound:
        "The historical source is not available for this execution.",
      integrity:
        "The historical source did not pass the availability and integrity checks.",
      generic:
        "The historical source could not be retrieved at this time.",
      previewEncoding:
        "The preview cannot be displayed because the historical source is not valid UTF-8. You can still download the original file.",
      forbidden:
        "Your account does not have permission to view this source.",
    },
    close: "Close",
    download: {
      action: "Download source",
      downloading: "Downloading…",
      success: "Source downloaded successfully.",
    },
  },

  submissionOverview: {
    fallbacks: {
      unavailable: "Unavailable",
      noCourse: "No associated course",
      untitledExperiment: "Untitled experiment",
      unnamedFile: "Unnamed file",
      notReported: "Not reported",
      noData: "No data",
    },
    labels: {
      period: "Period",
      originalArchive: "Original archive",
      created: "Created",
      course: "Course",
      protocol: "Protocol",
      protocolRecord: "Protocol #{{id}}",
      language: "Language",
      implementations: "Implementations",
      benchmark: "Benchmark",
      duration: "Duration",
      result: "Result",
      measurementNode: "Measurement node",
      registeredHardwareProfile:
        "Registered hardware profile",
      environment: "Environment",
      shaHelp: "ZIP SHA-256: fingerprint used to verify that the original file has not changed.",
    },
    aggregateStates: {
      inProgress: "In progress",
      completed: "Completed",
      partial: "Partial",
      failed: "Error",
      cancelled: "Cancelled",
      empty: "No executions",
      unknown: "Unknown",
    },
    executionStates: {
      queued: "Queued",
      running: "Running",
      processing: "Processing",
      completed: "Completed",
      failed: "Error",
      cancelled: "Cancelled",
      unknown: "Unknown",
    },
    results: {
      available: "Available",
      pending: "Pending",
      unavailable: "Unavailable",
    },
    states: {
      loadingTitle: "Loading experiment",
      loadingDescription:
        "Retrieving its metadata and implementation status.",
      errorTitle: "The experiment could not be loaded",
      errorDescription:
        "Check your session or try the request again.",
      notFoundTitle: "Experiment unavailable",
      notFoundDescription:
        "No information was found for this experiment.",
      emptyTitle: "No executions",
      emptyDescription:
        "This experiment does not have any executable implementations yet.",
    },
    header: {
      experimentNumber: "Experiment #{{id}}",
    },
    information: {
      eyebrow: "Provenance",
      title: "Experiment information",
    },
    archive: {
      verifying: "Checking original archive…",
      downloading: "Downloading…",
      downloadAction: "Download original ZIP",
      unavailable: "Original archive unavailable",
      verifyError:
        "The availability of the original archive could not be verified.",
      downloadSuccess:
        "Original ZIP downloaded successfully.",
      downloadError:
        "The original ZIP could not be downloaded.",
      downloadNetwork:
        "We could not connect to download the original ZIP.",
      downloadSession:
        "Your session does not allow downloading the original ZIP.",
    },
    personal: {
      eyebrow: "Only you",
      title: "Personal metadata",
      updating: "Updating…",
      reference: "Comparison reference",
      markReference: "Mark as comparison reference",
      referenceHint: "Highlight this experiment so its completed executions can be used as references in later comparisons.",
      referenceUnavailableHint:
        "This experiment does not yet have completed executions with available results, so it cannot be used as a comparison reference yet.",
      referencePinnedUnavailableHint:
        "This experiment is marked as a reference, but it currently has no completed executions with available results. You can remove the reference mark if it no longer applies.",
      archived: "Archived",
      archive: "Archive",
      restore: "Restore",
      note: "Personal note",
      characters: "{{count}}/{{max}} characters",
      saving: "Saving…",
      noNote: "No personal note",
    },
    feedback: {
      noteSaved: "Personal note saved.",
      pinned: "Experiment marked as a comparison reference.",
      unpinned: "Experiment removed from comparison references.",
      archived: "Experiment archived.",
      restored: "Experiment restored.",
      shaCopied: "SHA copied",
      shaCopyFailed: "Could not copy",
    },
    errors: {
      noteSave:
        "The note could not be saved. Review the content and try again.",
      referenceUpdate:
        "The reference could not be updated. Try again.",
      archiveUpdate:
        "The archive state could not be updated. Try again.",
    },
    summary: {
      eyebrow: "Aggregate status",
      title: "Summary",
      executions: "Executions",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    },
    implementations: {
      eyebrow: "Source code",
      title: "Implementations",
      description:
        "Each C/C++ source keeps its own execution and independent results.",
      hierarchy:
        "Each .c or .cpp source in the experiment creates an independent execution and keeps its own results.",
    },
    reference: {
      regionAria: "Compatible references for comparison",
      title: "Compare with reference",
      description: "Experimental references for {{name}}.",
      loading: "Finding references and evaluating compatibility…",
      empty:
        "No comparable references are available for this execution. Only experiments marked as references with compatible results will appear here.",
      compare: "Compare",
      errors: {
        forbidden:
          "Personal references are available only to their owner.",
        load: "Experimental references could not be loaded.",
      },
    },
    previous: {
      loading: "Finding previous…",
      none: "There is no compatible previous execution.",
      error:
        "The compatible previous execution could not be found.",
    },
    comparison: {
      needTwo:
        "At least two completed implementations with results are required.",
      noneAvailable:
        "This experiment does not yet have completed implementations with available results to compare.",
      needAnother:
        "One implementation has available results. At least one more comparable implementation is required to start a comparison.",
      regionAria:
        "Implementation selection for comparison",
      title: "Select comparable implementations",
      selectRange: "Select between 2 and 4 implementations.",
      preselected:
        "Eligible implementations are preselected. You can adjust the selection before continuing.",
      maxFeedback:
        "You can compare at most four implementations. Deselect one to free another slot.",
      compareSelected:
        "Compare selected ({{count}})",
      selectFile: "Select {{name}}",
      notEligible: "Not eligible: {{reason}}",
      reasons: {
        failed: "The execution ended with an error.",
        inProgress: "The execution is still in progress.",
        notCompleted: "The execution is not completed yet.",
        noResults: "The execution has no available results.",
        invalidId: "The execution does not have a valid identifier.",
      },
    },
    execution: {
      sourceMarker: "Source for this execution",
      technicalId: "Technical ID",
      record: "Record {{id}}",
      executionNumber: "Execution #{{id}}",
    },
    failure: {
      title:
        "The implementation could not complete the analysis.",
      noDetail:
        "The server did not provide additional failure details.",
      stage: "Stage",
      code: "Code",
    },
    cancellation: {
      action: "Cancel execution",
      pending: "Cancelling…",
      stateChanged:
        "The execution changed state before it could be cancelled.",
      network: "Could not connect to cancel the execution.",
      session: "Your session cannot cancel this execution.",
      error: "Could not cancel the execution. Try again.",
    },
    actions: {
      retry: "Retry",
      copySha: "Copy full SHA-256",
      cancel: "Cancel",
      close: "Close",
      save: "Save",
      edit: "Edit",
      refreshStates: "Refresh statuses",
      compareImplementations: "Compare implementations",
      viewCode: "View code",
      reuseConfiguration: "Reuse configuration",
      repeatExperiment: "Repeat experiment",
      compareReference: "Compare with reference",
      comparePrevious: "Compare with compatible previous",
      viewResult: "View result",
    },
  },

  comparisonModel: {
    query: {
      count: "The URL must include between 2 and 4 implementations.",
      empty: "The URL contains an empty implementation.",
      duplicate: "Each implementation must appear only once.",
    },
    historicalStatuses: {
      compatible: "Compatible",
      limited: "Limited",
      incompatible: "Incompatible",
      unavailable: "Unavailable",
    },
    ineligibility: {
      failed: "The execution ended with an error.",
      active: "The execution is still in progress.",
      notCompleted: "The execution is not completed yet.",
      noResults: "The execution has no available results.",
      invalidId: "The execution has no valid identifier.",
    },
    genericMetric: "Metric",
    metrics: {
      DurationTime: {
        label: "Execution time",
        interpretation:
          "Lower values represent lower observed execution time across the compared input sizes.",
      },
      IPC: {
        label: "Instructions per cycle (IPC)",
        interpretation:
          "Higher IPC describes more retired instructions per cycle, but by itself does not imply lower total execution time.",
      },
      CacheMissRate: {
        label: "Cache miss rate",
        interpretation:
          "A lower rate indicates fewer observed cache misses; by itself it does not establish the cause of performance.",
      },
      BranchMissRate: {
        label: "Branch misprediction rate",
        interpretation:
          "A lower rate indicates fewer observed branch mispredictions; by itself it is not a causal explanation.",
      },
      EnergyPkg: {
        label: "CPU package energy",
        interpretation:
          "Compare energy only when it is available for every selected implementation.",
      },
    },
    interpretations: {
      limited:
        "This comparison is valid only within the limitations shown.",
      incompatible:
        "The comparison was blocked to prevent unsupported experimental conclusions.",
      partialOverlap:
        "The comparison is limited to input sizes measured in common. No interpolation or extrapolation is performed outside that domain.",
      singleInput:
        "There is only one shared input size; this comparison cannot establish a scaling trend.",
      dispersion:
        "If dispersion is large relative to the observed differences, small differences should be interpreted cautiously.",
    },
    dimensions: {
      benchmark: "Benchmark",
      hardware: "Hardware",
      measurementBackend: "Backend",
      profile: "Profile",
      protocol: "Protocol",
      sourceToolchain: "Language and compiler",
      compilerFlags: "Compiler flags",
      sourceProvenance: "Provenance",
      inputSizes: "Input sizes",
      metrics: "Metrics",
    },
    dimensionStatuses: {
      compatible: "Compatible",
      limited: "Limited",
      incompatible: "Incompatible",
      unavailable: "Unavailable",
      unverifiable: "Not verifiable",
    },
    seriesFallback: "Implementation {{index}}",
    aggregation: {
      median: "Median",
      mean: "Mean",
    },
    hover: {
      inputSize: "InputSize",
      stddev: "Std. deviation",
      validSamples: "Valid samples",
      iqrOutliers: "IQR outliers",
    },
    historicalDateUnavailable: "Date unavailable",
  },

  comparisonPage: {
    sectionNavigation: {
      aria: "Comparison sections",
      implementations: "Implementations",
      summary: "Summary",
      interpretation: "Interpretation",
      ai: "AI assistance",
      metrics: "Metrics",
      audit: "Audit",
    },
    ai: {
      eyebrow: "Pedagogical complement",
      title: "AI-assisted comparative analysis",
      intro:
        "Complements the deterministic reading with a structured synthesis of the canonical comparative evidence.",
      privacy:
        "The assistant does not receive student source code, raw CSV data, or browser-supplied metrics as scientific evidence.",
      loading:
        "Generating a synthesis from the canonical comparison...",
      actions: {
        generate: "Generate comparative analysis",
        update: "Update analysis",
        loading: "Generating...",
      },
      status: {
        simulated:
          "Simulated response · development mode",
        generated: "AI-generated response",
        cached: "Reused from cache",
        fresh: "Generated for this comparison",
      },
      unavailable: {
        incompatible: {
          title:
            "AI unavailable for this comparison",
          description:
            "The comparison is incompatible, so there is no valid experimental basis for a comparative synthesis.",
        },
        noEvidence: {
          title: "Insufficient common evidence",
          description:
            "There are not enough commonly comparable metrics to generate an assisted synthesis.",
        },
      },
      sections: {
        summary: "Summary",
        patterns: "Observed patterns",
        tradeoffs: "Observed metric relationships",
        focus: "What to analyze",
        limitations: "Limitations",
      },
      empty: {
        summary: "No additional summary was reported.",
        patterns: "No additional patterns were reported.",
        tradeoffs:
          "No metric relationships were identified with sufficient evidence.",
        focus: "No additional analysis targets were reported.",
        limitations: "No additional limitations were reported.",
      },
      providers: {
        mock: "Local deterministic mock",
        openai: "OpenAI",
        server: "Server",
      },
      meta: {
        provider: "Provider: {{provider}}",
        model: "Model: {{model}}",
        codeNotSent: "Source code sent: no",
        csvNotSent: "Raw CSV sent: no",
        browserMetricsNotTrusted:
          "Browser metrics used as evidence: no",
        canonicalComparison:
          "Comparison canonically rebuilt on the server",
      },
      errors: {
        notConfigured:
          "The AI provider is not configured on the server.",
        outputRejected:
          "The generated response did not pass the scientific validations and will not be shown. Measurements remain available.",
        provider:
          "The AI provider is temporarily unavailable. Measurements and charts were not affected.",
        timeout:
          "The AI provider took longer than expected. Measurements and charts remain available. Try again.",
        invalidLanguage:
          "The requested language is not supported.",
        unavailable:
          "This comparison does not have enough experimental basis for AI.",
        unauthorized:
          "Your session no longer allows this analysis.",
        forbidden:
          "You do not have permission to analyze one or more of these executions.",
        network:
          "We could not connect to the server.",
        generic:
          "The AI-assisted comparative analysis could not be generated.",
      },
    },
    actions: {
      back: "Back",
      retry: "Retry",
      remove: "Remove",
      add: "Add",
    },
    common: {
      profile: "Profile",
      compilerFlags: "Compiler flags",
      notVerifiable: "Not verifiable",
    },
    status: {
      compatible: {
        label: "Compatible",
        text:
          "The executions satisfy the compatibility contract for the common measurements shown.",
      },
      limitedCoverage: {
        label: "Valid comparison · partial coverage",
        text:
          "Comparable experimental conditions are preserved; one or more target metrics are not commonly available.",
      },
      limited: {
        label: "Comparison with limited scope",
        text:
          "There are experimental warnings beyond metric coverage; interpret only the common domain and conditions indicated.",
      },
      incompatible: {
        label: "Incompatible comparison",
        text:
          "These executions do not satisfy the contract required to overlay their performance results.",
      },
    },
    requestErrors: {
      network: {
        title: "No connection to the server",
        description: "We could not connect to the server.",
      },
      unauthorized: {
        title: "Session unavailable",
        description:
          "Your session no longer allows access to this comparison.",
      },
      forbidden: {
        title: "Comparison restricted",
        description:
          "You do not have permission to compare one or more of these executions.",
      },
      notFound: {
        title: "Results unavailable",
        description:
          "One of the executions or its results is no longer available.",
      },
      notReady: {
        title: "Results not publishable yet",
        description:
          "One of the executions does not have publishable results yet.",
      },
      notComparable: {
        title: "Results not comparable",
        description:
          "The results do not satisfy the contract required for comparison.",
      },
      generic: {
        title: "Unable to load comparison",
        description: "The comparison could not be loaded.",
      },
    },
    candidateErrors: {
      network: {
        title: "No connection to the server",
        description: "We could not connect to the server.",
      },
      forbidden: {
        title: "History unavailable",
        description:
          "Your session does not allow access to historical executions for this selection.",
      },
      generic: {
        title: "Unable to load history",
        description:
          "Historical executions could not be loaded.",
      },
    },
    context: {
      experiment: "Experiment",
      experimentNumber: "Experiment #{{id}}",
      backExperiment: "Back to experiment",
      differentExperiments:
        "Executions from different experiments",
    },
    states: {
      invalid: {
        title: "Invalid comparison",
      },
      loading: {
        title: "Loading comparison",
        description:
          "We are gathering the structured results for the selected implementations.",
      },
    },
    header: {
      eyebrow: "Comparison analysis",
      title: "Implementation comparison",
      selectionCount: {
        one: "{{count}} implementation selected",
        other: "{{count}} implementations selected",
      },
    },
    implementations: {
      eyebrow: "Series",
      title: "Implementations",
      maxFour: "Maximum 4 implementations",
      closeHistory: "Close history",
      addHistorical: "Add historical execution",
      removeAria: "Remove {{name}}",
    },
    history: {
      eyebrow: "Accessible history",
      title: "Historical executions",
      description:
        "Each option is evaluated together with the current selection before it can be added.",
      showIncompatible: "Show incompatible",
      loading: {
        title: "Searching historical executions",
        description:
          "We are checking compatibility and permissions for the current selection.",
      },
      empty: {
        title: "No compatible executions",
        description:
          "We found no historical executions compatible with the current selection.",
      },
      candidateFallback: "Historical implementation {{index}}",
      date: "Date",
      alreadySelected: "Already selected",
      cannotAdd: "Cannot add",
      truncated:
        "Recent executions available within the search limit are shown.",
    },
    summary: {
      eyebrow: "Comparative view",
      title: "Comparative summary",
      description:
        "Mini trends show already-reported medians over each target metric's common domain. Values correspond to the largest available common InputSize.",
      availability:
        "{{available}} of {{total}} target metrics comparable",
      coverageLabel: "target metrics comparable",
      inputSize: "InputSize {{inputSize}}",
      reportedMedian: "Reported median",
      trendAria: "Comparative trend for {{metric}}",
      unavailableBadge: "Not comparable",
      unavailableDescription:
        "There is no valid common series for all selected implementations.",
      noRanking:
        "The summary presents evidence by metric. It does not compute a winner or a global score.",
      empty: {
        title: "No comparable target metrics",
        description:
          "There are no target metrics with a verifiable common median to summarize.",
      },
    },
    audit: {
      eyebrow: "Experimental validity",
      title: "Comparability audit",
      description:
        "Review benchmark, hardware, backend, profile, protocol, flags, provenance, input domain, and metric coverage.",
      show: "Show details",
      hide: "Hide details",
    },
    auditDetails: {
      summaryAria:
        "Comparability audit summary",
      summary: {
        dimensions: "Dimensions",
        blockers: "Blockers",
        warnings: "Warnings",
        excluded: "Excluded metrics",
      },
      noAdditionalFindings:
        "No blockers, additional warnings, or excluded metrics were reported.",
      unknownIssue:
        "A comparability observation was reported ({{code}}).",
      unknownExclusion:
        "The metric was excluded from the common comparison ({{code}}).",
      issueMessages: {
        BENCHMARK_UNVERIFIED:
          "The benchmark could not be verified for every execution.",
        BENCHMARK_MISMATCH:
          "The executions use different benchmarks.",
        HARDWARE_UNVERIFIED:
          "The observed hardware could not be verified for every execution.",
        HARDWARE_MISMATCH:
          "The executions were measured on different observed hardware.",
        MEASUREMENT_BACKEND_UNVERIFIED:
          "The measurement backend could not be verified.",
        MEASUREMENT_BACKEND_MISMATCH:
          "The executions use different measurement backends.",
        MEASUREMENT_BACKEND_VERSION_UNVERIFIED:
          "The backend version could not be verified for every execution.",
        MEASUREMENT_BACKEND_VERSION_DIFFERS:
          "The observed measurement-backend versions differ.",
        PROFILE_UNVERIFIED:
          "The execution profile could not be verified.",
        PROFILE_MISMATCH:
          "The executions use different profiles.",
        PROTOCOL_UNVERIFIED:
          "The complete measurement protocol could not be verified.",
        PROTOCOL_MISMATCH:
          "The executions use different measurement protocols.",
        SOURCE_TOOLCHAIN_UNVERIFIED:
          "The language and compiler could not be verified for every execution.",
        SOURCE_TOOLCHAIN_DIFFERS:
          "The executions use different languages or compilers; interpret the metrics as a comparison between implementations under different toolchains.",
        COMPILER_VERSION_UNVERIFIED:
          "The observed compiler version could not be verified for every execution.",
        COMPILER_VERSION_DIFFERS:
          "The observed compiler versions differ.",
        COMPILER_FLAGS_UNVERIFIED:
          "The compiler flags could not be verified.",
        COMPILER_FLAGS_MISMATCH:
          "The executions use different compiler flags.",
        AMBIGUOUS_RESULT_PROVENANCE:
          "One execution contains results associated with multiple sources.",
        DURATION_UNAVAILABLE:
          "Execution time is not available in comparable form.",
        NO_COMMON_INPUT_SIZE:
          "The executions share no measured InputSize.",
        PARTIAL_INPUT_OVERLAP:
          "The executions share only part of the measured InputSize domain.",
        SINGLE_COMMON_INPUT_SIZE:
          "The comparison has only one common InputSize.",
        TARGET_METRIC_UNAVAILABLE:
          "The target metric is not comparably available for every execution.",
        METRIC_UNIT_MISMATCH:
          "The reported unit for the target metric differs across executions.",
        METRIC_PARTIAL_COVERAGE:
          "The metric covers only part of the common InputSize domain.",
      },
      excludedReasons: {
        TARGET_METRIC_UNAVAILABLE:
          "It is not commonly available for every execution.",
        METRIC_UNIT_MISMATCH:
          "It was excluded because the reported unit differs across executions.",
        DURATION_UNAVAILABLE:
          "It cannot be built as a common metric because execution time is not comparably available.",
        NO_COMMON_INPUT_SIZE:
          "It cannot be built over a commonly measured InputSize.",
      },
    },
    dimensions: {
      eyebrow: "Scientific contract",
      title: "Compatibility by dimension",
    },
    observations: {
      eyebrow: "Scope",
      title: "Observations",
      blocker: "Compatibility blocker",
      blockerFallback: "Incompatible dimension.",
      limitation: "Limitation",
      warningFallback: "Comparison with limited scope.",
    },
    excluded: {
      eyebrow: "Coverage",
      title: "Non-comparable metrics",
      fallback:
        "It is not commonly available.",
    },
    pedagogy: {
      eyebrow: "Deterministic interpretation",
      title: "Comparative reading of the evidence",
      description:
        "Summarizes what was observed in comparable target metrics using already-reported aggregates.",
      deterministic: "Deterministic rules",
      metric: "Metric",
      whatItRepresents: "What it represents",
      whatWasObserved: "What occurred in this comparison",
      observedAt: "Reported medians at InputSize {{inputSize}}",
      details: "Evidence and context",
      detailsHint: "{{count}} sections",
      show: "Show detail",
      hide: "Hide detail",
      trend: "Observed trend",
      variability: "Variability",
      limitations: "Limitations",
      noTrend:
        "There is only one common InputSize for this metric; a scaling trend is not described.",
      trendLine:
        "Between InputSize {{firstInput}} and {{lastInput}}, the median {{direction}} from {{firstValue}} to {{lastValue}}.",
      directions: {
        increased: "increased",
        decreased: "decreased",
        unchanged: "remained unchanged",
        unavailable: "could not be described",
      },
      variabilityLine:
        "At InputSize {{inputSize}}: Q1–Q3 {{q1}}–{{q3}} · σ {{stddev}}.",
      variabilityUnavailable:
        "No comparable numeric dispersion was reported for this point.",
      partialMetricCoverage:
        "This metric covers {{metricCount}} of {{scopeCount}} common InputSize values.",
      metricWarnings:
        "The audit records {{count}} metric-specific warning for this metric.",
      scopeTitle: "Scope of this reading",
      scopeText:
        "The comparison contains warnings or excluded target metrics. This interpretation uses only the comparable domain and evidence; technical detail remains in the audit.",
      excludedMetrics:
        "Target metrics not comparable: {{metrics}}.",
      principle:
        "This reading describes observed evidence. It assigns no global winner, establishes no causality, and does not classify asymptotic complexity.",
      implementation: "Implementation {{index}}",
    },
    guidance: {
      eyebrow: "Cautious reading",
      title: "How to interpret this comparison",
    },
    explorer: {
      categoriesAria: "Comparative metric categories",
      categories: {
        primary: "Key metrics",
        performance: "Performance",
        cache: "Cache",
        cpu: "CPU",
        system: "System",
        energy: "Energy",
        other: "Other",
      },
      metricEyebrow: "Metric comparison",
      plotAria: "Comparative chart for {{metric}}",
      noPoints: "There are no visible points in the current range.",
      detailInspector: "Detailed metric inspector",
      detailInspectorHint: "One metric at a time · advanced view",
      empty: {
        title: "No metrics in this category",
        description:
          "No common metrics are available for the selected implementations in this category.",
      },
    },
    filters: {
      eyebrow: "Visualization",
      title: "Comparison filters",
      description:
        "They apply to every chart in this section and do not modify the reported measurements.",
      activeCount: "Active filters: {{count}}",
      reset: "Reset filters",
      aggregation: "Aggregation",
      median: "Median",
      mean: "Mean",
      aggregationHelp:
        "Selects an already reported central statistic; samples are not recomputed.",
      dispersion: "Dispersion",
      showDispersion: "Show dispersion",
      dispersionMedianHelp:
        "With median, error bars represent Q1–Q3 when those values are available.",
      dispersionMeanHelp:
        "With mean, error bars represent standard deviation when available.",
      horizontalScale: "Horizontal scale",
      linear: "Linear",
      logarithmic: "Logarithmic",
      horizontalScaleHelp:
        "Only the X-axis representation changes; measured values are not transformed.",
      logUnavailable:
        "Logarithmic scale requires strictly positive InputSize values.",
      inputRange: "InputSize range",
      rangeHelp:
        "Limits visible points within the common domain; it does not interpolate or extrapolate.",
    },
    chart: {
      eyebrow: "Common measurements",
      title: "Overlaid results",
      noMetrics: {
        title: "No comparable metrics",
        description:
          "The response does not contain a common metric available for plotting.",
      },
      metric: "Metric",
      aggregation: "Aggregation",
      showDispersion: "Show dispersion",
      rangeAria: "InputSize range",
      minimumInputSize: "Minimum InputSize",
      maximumInputSize: "Maximum InputSize",
      resetRange: "Reset range",
      medianLower: "median",
      meanLower: "mean",
      axisContext:
        "X axis: InputSize. Y axis: {{aggregation}}{{unit}}.",
      dispersionIqr: " Q1–Q3 dispersion.",
      dispersionStddev:
        " Dispersion using standard deviation.",
      dispersionHidden: " Dispersion hidden.",
      noPoints: {
        title: "No points for this range",
        description:
          "No central values are available in the selected range.",
      },
      plotAria: "Comparison chart for {{metric}}",
    },
  },

  reproducibilityPanel: {
    publicIdHelp: "Stably identifies this execution. Knowing the identifier does not grant access to the result.",
    artifactShaHelp: "SHA-256 fingerprints let you verify that downloaded artifacts match those recorded for this execution.",
    bundleHelp: "This package includes this execution's source, CombinedResults.csv, and manifest.json with configuration and experimental context. It helps preserve and review the evidence needed to repeat the same experimental configuration.",
    common: {
      unavailable: "Unavailable",
      yes: "Yes",
      no: "No",
    },
    availability: {
      available: "Available",
      unavailable: "Unavailable",
    },
    integrity: {
      verified: "Verified",
      unavailable: "Unavailable",
      unverified: "Unverified",
      mismatch: "Mismatch",
      invalidReference: "Invalid reference",
      invalidArchive: "Invalid ZIP",
    },
    resources: {
      manifest: "the manifest",
      provenance: "the provenance data",
      source: "the source",
      manifestJson: "the JSON manifest",
      csv: "the CSV",
      bundle: "the reproducibility bundle",
    },
    requestErrors: {
      network: "Could not connect to load {{resource}}.",
      forbidden: "Your session does not allow access to {{resource}}.",
      notFound: "{{resource}} is not available for this execution.",
      generic: "Could not load {{resource}}.",
    },
    downloadErrors: {
      network: "Could not connect to download {{resource}}.",
      forbidden: "Your session does not allow downloading {{resource}}.",
      notFound: "{{resource}} is not available for this execution.",
      generic: "Could not download {{resource}}.",
    },
    download: {
      success: "{{resource}} was downloaded successfully.",
    },
    header: {
      eyebrow: "Experimental identity",
      title: "Reproducibility and experimental traceability",
      description:
        "Code, hardware, configuration, and verifiable artifacts.",
    },
    disclosure: {
      expand: "Show details",
      collapse: "Hide details",
    },
    loading: "Loading reproducible identity…",
    partial: {
      scientificResultsRemain:
        "Scientific results remain available.",
    },
    source: {
      title: "Source for this execution",
    },
    executionStates: {
      queued: "Queued",
      running: "Running",
      processing: "Processing",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    },
    fields: {
      technicalId: "Technical ID",
      state: "State",
      sourceLanguage: "Source language",
      metadataProvenance: "Metadata provenance",
      created: "Created",
      finished: "Finished",
      size: "Size",
      profile: "Profile",
      inputSize: "Input size",
      samples: "Samples",
      configuredCompiler: "Configured compiler",
      compilerFlags: "Compiler flags",
      points: "Points",
      samplesPerPoint: "Samples per point",
      warmupRounds: "Warmup rounds",
      perfScope: "perf scope",
      eventFallback: "Per-event fallback",
      cpuVendor: "CPU vendor",
      cpuModel: "CPU model",
      architecture: "Architecture",
      logicalCpus: "Logical CPUs",
      backend: "Backend",
      version: "Version",
      requestedScope: "Requested scope",
      observedCompiler: "Observed compiler",
      observedCompilerVersion: "Observed version",
    },
    metadataProvenance: {
      explicit: "Explicit (v2 contract)",
      inferredLegacyCpp: "Inferred (legacy C++)",
    },
    copy: {
      idAction: "Copy ID",
      linkAction: "Copy link",
      publicIdSuccess: "Public ID copied",
      linkSuccess: "Link copied",
      error: "Could not copy",
    },
    configuration: {
      title: "Configuration",
    },
    hardware: {
      title: "Hardware observed during execution",
      note: "This is not the requested profile.",
    },
    artifacts: {
      source: "Source",
      measurements: "Measurements",
      originalArchive: "Original archive",
    },
    actions: {
      aria: "Reproducibility actions",
      viewCode: "View code",
      downloading: "Downloading…",
      downloadSource: "Download source",
      downloadManifest: "Download JSON manifest",
      downloadCsv: "Download CSV",
      downloadBundle: "Download reproducibility bundle",
    },
  },

  renderImage: {
    sectionNavigation: {
      aria: "Result sections",
      summary: "Summary",
      interpretation: "Interpretation",
      metrics: "Metrics",
      reproducibility: "Reproducibility",
    },
    executionFallback: "Execution {{codename}}",
    common: {
      back: "Back",
      retry: "Retry",
      range: "range {{min}}–{{max}}",
    },
    loading: {
      title: "Loading results",
      description: "Preparing the execution dashboard.",
    },
    errors: {
      titles: {
        network: "Could not connect to the server",
        forbidden: "You cannot open this execution",
        notFound: "Execution not found",
        unavailable: "Result not available yet",
        generic: "Could not open this execution",
      },
      descriptions: {
        network:
          "We could not reach the server. Check that the backend is available and try again.",
        forbidden:
          "This execution exists, but your account does not have permission to view its results.",
        notFound:
          "The execution or one of its result artifacts is no longer available.",
        unavailable:
          "This execution does not have results ready to display yet.",
        session:
          "Your session no longer allows access to this execution. Sign in again.",
        generic:
          "The results for this execution could not be loaded.",
      },
    },
    download: {
      action: "Download CSV",
      downloading: "Downloading...",
      success: "CSV downloaded successfully.",
      errors: {
        generic: "The CSV could not be downloaded at this time.",
        network:
          "We could not connect to the server to download the CSV.",
        forbidden:
          "Your account does not have permission to download this CSV.",
        notFound:
          "The CSV for this execution is no longer available.",
      },
    },
    header: {
      viewExperiment: "View experiment",
      analysisCompleted: "Analysis completed",
      eyebrow: "Performance results",
      description:
        "Explore how program behavior changes as the input size increases.",
    },
    registeredProvenance: {
      measurementNode: "Measurement node",
      measurementNodeDescription:
        "Registered node that executed this measurement.",
      hardwareProfile: "Hardware profile",
      hardwareProfileDescription:
        "Capability profile associated with the node during the execution.",
    },
    categories: {
      aria: "Metric categories",
      summary: "Summary",
      performance: "Performance",
      cache: "Cache",
      cpu: "CPU",
      system: "System",
      energy: "Energy",
    },
    toolbar: {
      filters: "Filters",
      advancedMetrics: "Advanced metrics",
    },
    summary: {
      eyebrow: "Main view",
      title: "Key metrics",
      description:
        "These metrics provide an initial view of execution time, CPU work, memory, and control flow.",
      missingPrimary: {
        one: "{{count}} primary metric is unavailable for this execution.",
        other:
          "{{count}} primary metrics are unavailable for this execution.",
      },
    },
    empty: {
      title: "No metrics available in this category",
      description:
        "This execution did not generate charts for the selected metrics.",
    },
    footer: {
      note:
        "Available metrics are rendered from the JSON API. When a measurement is unavailable, the dashboard states the reason explicitly instead of drawing an empty chart or assuming a zero value.",
    },
    filters: {
      eyebrow: "Visualization",
      title: "Analysis filters",
      description:
        "They only change how results are presented; they do not modify the original measurements.",
      reset: "Reset",
      aggregation: "Aggregation",
      mean: "Mean",
      median: "Median",
      aggregationHelp:
        "Defines the central value shown in charts and KPIs.",
      dispersion: "Dispersion",
      iqrInterval: "Q1–Q3 interval",
      stddevInterval: "± standard deviation",
      iqrHelp:
        "Shows the central 50% of observations around the median.",
      stddevHelp:
        "Shows the sample standard deviation around the mean.",
      horizontalScale: "Horizontal scale",
      linear: "Linear",
      horizontalScaleHelp:
        "Only affects the input-size axis.",
      inputRange: "Input range",
      from: "From",
      to: "To",
      minimum: "Minimum",
      maximum: "Maximum",
      rangeHelp: "Limits visible points without changing the CSV.",
      singleInputHelp:
        "This execution contains a single input size.",
    },
    kpiOverview: {
      eyebrow: "Quick view",
      title: "Main indicators",
      description:
        "{{aggregation}} value at the largest visible input size{{range}}.",
      availabilitySummary:
        "{{available}} of {{total}} main indicators available.",
    },
    kpis: {
      DurationTime: {
        label: "Time",
        description: "Execution time",
      },
      IPC: {
        label: "IPC",
        description: "Instructions per cycle",
      },
      CacheMissRate: {
        label: "Cache miss",
        description: "Cache miss rate",
      },
      BranchMissRate: {
        label: "Branch miss",
        description: "Branch mispredictions",
      },
      Instructions: {
        label: "Instructions",
        description: "CPU work executed",
      },
    },
    kpiCard: {
      inputSize: "Input size {{inputSize}}",
      unavailable: "Unavailable",
      noValidData:
        "No valid data was obtained for this indicator.",
      validSamples: "{{valid}}/{{total}} valid samples",
      implementations: {
        one: "{{count}} implementation",
        other: "{{count}} implementations",
      },
    },
    metadata: {
      benchmark: "Benchmark",
      benchmarkDescription: "Executed test type",
      maxSize: "Maximum size",
      maxSizeDescription: "Configured input limit",
      repetitions: "Repetitions",
      repetitionsDescription: "Per measurement point",
      environment: "Environment",
      managed: "Managed",
      environmentDescription:
        "Node configured by Performance System",
      course: "Course",
      noCourse: "No associated course",
      period: "Period",
      personalAnalysis: "Personal analysis",
      tasks: {
        lcs: "Text input",
        numeric: "Numeric data",
        size: "Parameterized size",
      },
    },
  },

  renderImageScientific: {
    metricCard: {
      genericMetric: "Metric",
      genericDescription:
        "This metric does not have a configured pedagogical description yet.",
      explainAria: "Explain {{metric}}",
      represents: "What it represents",
      legacyCompatibility: "Legacy compatibility",
      noVisualizationData: "No visualization data",
    },
    chart: {
      executionSeries: "Execution",
      inputSize: "Input size",
      mean: "Mean",
      median: "Median",
      stddev: "Std. deviation",
      numericSamples: "Numeric samples",
      iqrOutliers: "IQR outliers detected",
      legacyFrameTitle: "Chart for {{title}}",
    },
    pedagogy: {
      eyebrow: "Guided interpretation",
      title: "What the results show",
      deterministic: "Based on reproducible rules",
      disclaimer:
        "These conclusions describe only the measurements from this execution. By themselves, they do not classify an algorithm as good, bad, efficient, or inefficient.",
      whatItRepresents: "What it represents",
      metricHeading: "What happened in this execution",
      evidenceDisclosure: {
        count: "{{count}} evidence items available",
        show: "Show",
        hide: "Hide",
      },
      meaningFallback:
        "Experimental metric observed during this execution.",
      kinds: {
        snapshot: "Observed value",
        trend: "Observed trend",
        observedScaling: "Observed scaling",
        outliers: "Variability",
        coverage: "Coverage",
        limitation: "Scope",
        availability: "Availability",
        analysis: "Analysis",
      },
      messages: {
        snapshot: {
          base:
            "{{metric}}: at the largest measured input size ({{inputSize}}), the median was {{median}}.",
          iqr: "The Q1–Q3 interval ranged from {{q1}} to {{q3}}.",
          mean: "As a complementary reference, the mean was {{mean}}.",
          stddev: "The standard deviation was {{stddev}}.",
          cv: "The classical coefficient of variation was {{cv}}.",
        },
        trend: {
          base:
            "Between input sizes {{firstInput}} and {{lastInput}}, {{metric}} changed from {{firstValue}} to {{lastValue}}.",
          increase: "A relative increase of {{change}} was observed.",
          decrease: "A relative decrease of {{change}} was observed.",
          noChange: "No relative change was observed.",
          pairwise:
            "Across {{comparisons}} consecutive intervals: {{increasing}} increases, {{decreasing}} decreases, and {{unchanged}} with no appreciable change.",
        },
        observedScaling:
          "On the observed log-log scale over medians, {{metric}} had an empirical exponent of {{exponent}} with R²={{rSquared}}. This describes only the measured points and is not an asymptotic-complexity classification.",
        outliers: {
          detected:
            "The 1.5× IQR criterion flagged {{detected}} of {{evaluated}} evaluated samples ({{rate}}) as potentially atypical. The observations were retained in the aggregates.",
          groups:
            "The diagnostic was applied to {{diagnostic}} of {{total}} input points.",
          insufficient:
            "The IQR criterion was not applied as a diagnostic because the available points did not meet the minimum sample requirement. No samples were removed.",
        },
        singleInputLimitation:
          "This execution contains a single input size for this metric, so a trend with respect to input size cannot be described.",
        partialCoverage:
          "{{numeric}} of {{total}} measurement rows contain a numeric value for this metric.",
        availability: {
          permissionDenied:
            "This metric was not measured because the measurement process did not have sufficient permission to access the requested performance event. A missing measurement is not interpreted as zero.",
          unsupported:
            "This metric was not measured because the hardware event is not supported by the observed environment. A missing measurement is not interpreted as zero.",
          notCounted:
            "The event was recognized, but no valid count was obtained during this execution. A missing measurement is not interpreted as zero.",
          noNumeric:
            "No valid numeric observations were obtained for this metric. A missing measurement is not interpreted as zero.",
        },
        fallback:
          "The structured evidence for this observation cannot be presented by the current interface version.",
      },
    },
    ai: {
      eyebrow: "Pedagogical complement",
      title: "AI-assisted analysis",
      intro:
        "This module complements the deterministic interpretation with a structured reading of the available evidence.",
      privacy:
        "The assistant does not receive student source code or raw CSV data.",
      actions: {
        generate: "Generate AI analysis",
        update: "Update analysis",
        loading: "Generating...",
      },
      status: {
        simulated:
          "Simulated response · development mode",
        generated:
          "AI-generated response",
        cached:
          "Reused from cache",
        fresh:
          "Generated for this execution",
      },
      sections: {
        summary: "Summary",
        patterns: "Observed patterns",
        observe: "What to inspect next",
        limitations: "Limitations",
      },
      emptyPatterns:
        "The assistant did not report additional patterns for this execution.",
      emptyLimitations:
        "No additional limitations were reported by the assistant.",
      providers: {
        mock: "Local mock",
        openai: "OpenAI",
        server: "Configured by server",
      },
      meta: {
        provider: "Provider: {{provider}}",
        model: "Model: {{model}}",
        codeNotSent: "Source code sent: no",
        csvNotSent: "Raw CSV sent: no",
      },
      metrics: {
        DurationTime: "Execution time",
        IPC: "IPC",
        CacheMissRate: "Cache miss rate",
        BranchMissRate: "Branch miss rate",
        Instructions: "Instructions",
        L1DcacheLoadMisses: "L1D load misses",
      },
      evidenceKinds: {
        snapshot: "Observed value",
        trend: "Observed trend",
        observedScaling: "Observed scaling",
        outliers: "Variability",
        coverage: "Coverage",
        limitation: "Limitation",
        availability: "Availability",
      },
      errors: {
        notConfigured:
          "Real AI is not configured on the server. The deterministic interpretation remains available.",
        outputRejected:
          "The response was discarded because it did not pass the consistency checks. Measurements remain available.",
        provider:
          "The AI provider is temporarily unavailable. Measurements and charts were not affected.",
        timeout:
          "The AI provider took longer than expected. Measurements and charts remain available. Try again.",
        invalidLanguage:
          "The requested language is not supported for assisted analysis.",
        unauthorized:
          "Your session no longer allows this analysis.",
        forbidden:
          "You do not have permission to analyze this execution.",
        network:
          "We could not connect to the server. Check your connection and try again.",
        generic:
          "The assisted analysis could not be generated at this time.",
      },
    },
    availability: {
      partial:
        "Partial availability: {{numeric}} of {{total}} samples contain a numeric value.",
      measurementContext: "Measurement context",
      notZero:
        "A missing measurement is not interpreted as a zero value.",
      metricUnavailableTitle: "{{title}} unavailable",
      metricUnavailableDescription:
        "There is no structured data or legacy visualization for this metric.",
      statuses: {
        permissionDenied: {
          label: "Permission denied",
          description:
            "The measurement process did not have sufficient permission to access the requested performance event.",
        },
        unsupported: {
          label: "Unavailable",
          description:
            "The measurement produced no valid numeric samples in the environment used for this execution.",
        },
        notCounted: {
          label: "Not counted",
          description:
            "The event was recognized, but perf could not obtain a valid count during this execution.",
        },
        noData: {
          label: "No valid data",
          description:
            "There were not enough numeric observations to represent this metric.",
        },
        default: {
          label: "Unavailable",
          description:
            "This metric has no representable data in the current execution.",
        },
      },
      summary: {
        permissionDenied:
          "{{total}}/{{total}} samples could not access this event because the measurement process lacked sufficient permission.",
        permissionDeniedRows:
          "{{count}}/{{total}} samples could not access the event because of insufficient permission.",
        eventNotExposed:
          "{{total}}/{{total}} samples did not have this event available in the measurement backend.",
        notSupported:
          "{{total}}/{{total}} samples could not measure this event in the observed environment.",
        notCounted:
          "{{total}}/{{total}} samples did not produce a valid count for this event.",
        backendError:
          "The event availability for {{total}} samples could not be verified because of a measurement-backend problem.",
        noNumericSample:
          "{{total}}/{{total}} samples had no valid numeric observation for this event.",
        unsupported:
          "{{count}}/{{total}} samples reported the event as unavailable.",
        notCountedRows:
          "{{count}}/{{total}} samples could not be counted.",
        noData:
          "{{count}}/{{total}} samples had no valid numeric value.",
      },
      provenance: {
        metric_availability_sidecar: "preserved provenance",
        raw_csv_fallback: "recovered provenance",
      },
    },
    hardware: {
      requestedEvent: "the requested event",
      permissionDenied:
        "The event {{event}} could not be measured because the measurement process does not have sufficient permission to access it.",
      eventNotExposed:
        "The perf backend in this environment does not expose {{event}}.",
      notSupported:
        "The event {{event}} is exposed by perf, but the availability probe could not measure it in this environment.",
      notCounted:
        "The event {{event}} was recognized, but the availability probe did not produce a valid count.",
      backendError:
        "{{event}} could not be verified because of a measurement-backend problem.",
      noNumericSample:
        "The {{event}} probe did not produce a valid numeric sample.",
      numeric:
        "The {{event}} probe produced a valid numeric sample.",
      notExposedGeneric:
        "The measurement backend does not expose {{event}} in this environment.",
      requestedScope: "requested scope: {{scope}}",
      observedEnvironment: "Observed environment: {{details}}.",
    },
    footer: {
      apiData: "API data",
      median: "median",
      mean: "mean",
      stddev: "± standard deviation",
      logScale: "log X scale",
      range: "range {{min}}–{{max}}",
    },
    metrics: {
      DurationTime: {
        label: "Execution time",
        eyebrow: "Scaling",
        axisTitle: "Execution time (ms)",
        description: "Total program execution duration in milliseconds.\nIt is one of the most intuitive metrics because it indicates the actual time required to complete the task.\nIt is used as a primary reference when comparing speed across algorithms or configurations.",
      },
      TaskClock: {
        label: "Active task time",
        eyebrow: "CPU",
        axisTitle: "Active time (ms)",
        description: "Total active process execution time in milliseconds.\nIt indicates how long the CPU was effectively busy executing the process, including possible threads or concurrent tasks.\nIt is a key metric for comparing speed across different implementations.",
      },
      CpuClock: {
        label: "CPU time",
        eyebrow: "CPU",
        axisTitle: "CPU time (ms)",
        description: "Total CPU time consumed by the program in milliseconds.\nIt includes the time from all cores and threads used.\nIt measures total processing cost and is especially relevant for parallel or multithreaded algorithms.",
      },
      Instructions: {
        label: "Executed instructions",
        eyebrow: "CPU work",
        axisTitle: "Instructions",
        description: "Total number of instructions executed by the CPU while running the program.\nIt reflects the amount of basic work required to complete the task.\nA lower instruction count, when the result is unchanged, may indicate more optimized and efficient code.\nHowever, fewer instructions are not always better; interpretation depends on the implementation and algorithm.",
      },
      CpuCycles: {
        label: "CPU cycles",
        eyebrow: "CPU",
        axisTitle: "Cycles",
        description: "Total number of CPU clock cycles used to execute the program.\nEach CPU cycle is a clock tick during which the processor may execute part of an instruction.\nComparing cycles with instructions makes it possible to calculate IPC.\nFewer cycles for the same instruction count indicates more efficient processor use.",
      },
      IPC: {
        label: "Instructions per cycle (IPC)",
        eyebrow: "CPU efficiency",
        axisTitle: "IPC",
        description: "Instructions Per Cycle (IPC).\nCalculated as Instructions / CpuCycles.\nIt measures the average number of instructions executed per CPU cycle.\nA higher IPC indicates better processor utilization and greater execution efficiency.\nThe value depends on the workload and on how the compiler and CPU handle the instruction flow.",
      },
      Branches: {
        label: "Executed branches",
        eyebrow: "Control flow",
        axisTitle: "Branches",
        description: "Total number of conditional branches or jumps executed, such as if statements, loops, or jumps.\nThe processor predicts these branches to maintain an efficient execution flow.\nA high number of branches can make control flow less predictable and optimization more difficult.",
      },
      BranchMisses: {
        label: "Branch mispredictions",
        eyebrow: "Control flow",
        axisTitle: "Mispredictions",
        description: "Number of branch prediction failures.\nWhen the processor predicts incorrectly, already processed instructions may be discarded and the correct flow restarted.\nThis penalizes performance and increases latency.",
      },
      BranchMissRate: {
        label: "Branch misprediction rate",
        eyebrow: "Control flow",
        axisTitle: "Misprediction rate (%)",
        description: "Branch prediction miss rate.\nCalculated as BranchMisses / Branches.\nIt reflects how accurately the processor predicts control-flow branches such as if statements and loops.\nA lower rate means less pipeline penalty and can improve processor utilization.",
      },
      BranchMissesPerMI: {
        label: "Branch misses per million instructions",
        eyebrow: "Control flow",
        axisTitle: "Misses / million instructions",
        description: "Branch prediction misses per million instructions.\nCalculated as BranchMisses / (Instructions / 1e6).\nThis complements BranchMissRate by expressing misses per unit of executed work, making comparisons easier across implementations with different instruction volumes.\nLower values suggest more predictable control flow.",
      },
      CacheReferences: {
        label: "Cache references",
        eyebrow: "Memory",
        axisTitle: "Cache references",
        description: "Cache references reported by the system's generic performance counter.\nThey represent cache activity according to the semantics exposed by the processor PMU; the exact mapping to a cache level may vary by architecture.\nThis metric is interpreted mainly together with CacheMisses, not as a universal count of every access to every cache level.",
      },
      CacheMisses: {
        label: "Cache misses",
        eyebrow: "Memory",
        axisTitle: "Cache misses",
        description: "Cache misses reported by the system's generic performance counter.\nThe exact event semantics depend on the architecture and PMU, so this must not automatically be interpreted as the sum of misses at every cache level or as proof of a subsequent RAM access.\nIt is used together with CacheReferences to study the miss proportion observed by the available counter.",
      },
      CacheMissRate: {
        label: "Cache miss rate",
        eyebrow: "Memory",
        axisTitle: "Miss rate (%)",
        description: "Cache miss rate.\nCalculated as CacheMisses / CacheReferences.\nIt expresses the proportion of misses among the references reported by the generic counters available on that hardware.\nA lower rate may indicate a more favorable access pattern, but interpretation must consider the architecture and PMU semantics.",
      },
      CacheMissesPerMI: {
        label: "Cache misses per million instructions",
        eyebrow: "Memory",
        axisTitle: "Misses / million instructions",
        description: "Cache misses per million instructions.\nCalculated as CacheMisses / (Instructions / 1e6).\nThis normalizes cache misses by the total volume of executed instructions, enabling fairer comparisons between algorithms with different work volumes.\nLower values indicate better data locality and more efficient use of the memory hierarchy.",
      },
      L1DcacheLoads: {
        label: "L1 data-cache loads",
        eyebrow: "Memory",
        axisTitle: "L1 loads",
        description: "Number of reads from the L1 data cache.\nL1 is the cache closest to a CPU core: extremely fast but small, typically around 32–64 KB.\nAn L1 access has minimal latency.\nA high number of successful L1 reads reduces dependence on slower levels such as L2, L3, and RAM.",
      },
      L1DcacheLoadMisses: {
        label: "L1 data-cache load misses",
        eyebrow: "Memory",
        axisTitle: "L1 load misses",
        description: "Number of misses while reading the L1 data cache.\nOn an L1 miss, the CPU must search L2 or L3 and, ultimately, RAM, which is much slower.\nReducing these misses is important for avoiding memory bottlenecks.\n\nCache hierarchy:\n- L1: fastest and closest, but small.\n- L2: intermediate and larger.\n- L3: last cache level before RAM, larger and slower.",
      },
      L1DcacheStores: {
        label: "L1 data-cache stores",
        eyebrow: "Memory",
        axisTitle: "L1 stores",
        description: "Number of writes to the L1 data cache.\nKeeping data in L1 allows later operations such as loops or accumulations to execute with very low latency.\nEfficient L1 use reduces pressure on higher cache levels and lowers overall access time.",
      },
      LLCLoads: {
        label: "Last-level cache loads",
        eyebrow: "Memory",
        axisTitle: "LLC loads",
        description: "Number of reads from the Last Level Cache (LLC), which on most modern systems corresponds to L3.\nL3 is larger and slower than L1 and L2 and is often shared by multiple cores.\nAccessing the LLC is much faster than RAM but slower than L1 or L2.\nHigh LLC activity may indicate frequent access to data shared across threads or cores.",
      },
      LLCLoadMisses: {
        label: "Last-level cache load misses",
        eyebrow: "Memory",
        axisTitle: "LLC load misses",
        description: "Number of misses while reading the Last Level Cache, typically L3.\nAn LLC miss forces the CPU to retrieve data from RAM, introducing substantially more latency.\nReducing these misses can improve overall performance and energy use.",
      },
      LLCStores: {
        label: "Last-level cache stores",
        eyebrow: "Memory",
        axisTitle: "LLC stores",
        description: "Number of writes to the Last Level Cache, typically L3.\nThis level stores data that may be needed by other cores and helps prepare writes to RAM.\nEfficient use can reduce RAM pressure and support parallel execution.",
      },
      LLCStoreMisses: {
        label: "Last-level cache store misses",
        eyebrow: "Memory",
        axisTitle: "LLC store misses",
        description: "Number of misses while writing to the Last Level Cache.\nOn a miss, data may need to be written directly to RAM, which is slower and more expensive.\nReducing these misses generally requires coherent memory-access patterns and appropriate data structures.",
      },
      PageFaults: {
        label: "Page faults",
        eyebrow: "System",
        axisTitle: "Page faults",
        description: "Number of page faults.\nThey occur when the process accesses a memory page that is not resident in RAM and the operating system must resolve the fault.\nA high count can indicate memory pressure or access patterns that degrade performance.",
      },
      MajorFaults: {
        label: "Major page faults",
        eyebrow: "System",
        axisTitle: "Major faults",
        description: "Number of major page faults.\nThese require the operating system to load data from disk or swap.\nThey are very expensive in time and can significantly affect performance.\nReducing excessive memory use and improving access patterns can reduce these faults.",
      },
      EnergyPkg: {
        label: "CPU package energy",
        eyebrow: "Energy",
        axisTitle: "Energy (J)",
        description: "Energy recorded for the physical CPU Package domain during the benchmark measurement window (J).\nThe reading corresponds to the energy domain exposed by the platform and does not attribute that consumption exclusively to the student's process.\nIt is shown only when the measurement backend provides valid numeric samples.",
      },
      EnergyCores: {
        label: "CPU core energy",
        eyebrow: "Energy",
        axisTitle: "Energy (J)",
        description: "Energy recorded for the physical CPU core domain during the benchmark measurement window (J), when that domain is exposed by the platform and accessible to the backend.\nIt must not be interpreted as energy exclusive to the process or as a measurement available on all hardware.",
      },
      EnergyRAM: {
        label: "Memory energy",
        eyebrow: "Energy",
        axisTitle: "Energy (J)",
        description: "Energy recorded for the memory/DRAM domain during the benchmark measurement window (J), only when the platform exposes that domain and the backend can measure it.\nWhen this metric is absent it is represented as unavailable; it is never replaced with zero.",
      },
    },
  },


  teacherCommon: {
    actions: {
      retry: "Retry",
    },
    errors: {
      network:
        "Could not connect to the server. Check that the backend is available and try again.",
      session:
        "Your session expired. Sign in again to continue.",
      forbidden:
        "Your account does not have permission to perform this action.",
      notFound:
        "The requested information is not available.",
      service:
        "The service is temporarily unavailable. Try again in a few moments.",
      generic:
        "The requested information could not be loaded.",
    },
  },
  teacherCourseAnalytics: {
    common: {
      unavailable: "—",
    },
    loading: "Loading analytics",
    errors: {
      title: "Could not load analytics",
      load:
        "The course analytics could not be loaded.",
    },
    header: {
      eyebrow: "Aggregate monitoring",
      title: "Course analytics",
      description:
        "Participation, benchmarks, and activity without comparing performance across machines.",
    },
    kpis: {
      activeStudents: "Active students",
      submissions: "Experiments",
      executions: "Executions",
      completionRate:
        "Completed executions rate",
    },
    empty: {
      title: "No data yet",
    },
    axes: {
      students: "Students",
      executions: "Executions",
    },
    charts: {
      participation: {
        title: "Participation by student",
        description:
          "Active students grouped by number of executions.",
        buckets: {
          zero: "0 executions",
          oneToFour: "1–4",
          fiveToNine: "5–9",
          tenOrMore: "10+",
        },
        hover:
          "%{x}: %{y} students<extra></extra>",
        empty:
          "Add students to the course to visualize participation.",
      },
      benchmarks: {
        title: "Benchmarks used",
        description:
          "Distribution of executions across LCS, CAMM, and SIZE.",
        hover:
          "%{label}: %{value} executions (%{percent})<extra></extra>",
        empty:
          "Executions with a benchmark will appear here.",
      },
      activity: {
        title: "Activity over time",
        description:
          "Executions per day during the 30 days up to the most recent activity.",
        hover:
          "%{x}: %{y} executions<extra></extra>",
        empty:
          "There are no executions to show on the timeline yet.",
      },
    },
  },
  teacherCourseAttention: {
    common: {
      unavailable: "—",
    },
    loading:
      "Loading academic attention",
    errors: {
      title:
        "Could not load academic attention",
      load:
        "The academic-attention summary could not be loaded.",
    },
    header: {
      eyebrow:
        "Actionable supervision",
      title:
        "Academic attention",
      description:
        "Operational signals for finding cases worth reviewing, without grading or comparing students.",
    },
    refreshing: "Updating…",
    actions: {
      viewStudents: "View students",
      result: "Result",
      lastResultAria:
        "View latest result for {{name}}",
    },
    cards: {
      noExecutions: {
        title: "No executions",
        description:
          "Active students who have not recorded any executions yet.",
        aria: {
          one:
            "{{count}} student with no executions. View students.",
          other:
            "{{count}} students with no executions. View students.",
        },
      },
      failures: {
        title:
          "Predominant failures",
        description:
          "Students with more failed executions than completed executions.",
        aria: {
          one:
            "{{count}} student with more failures than completions. View students.",
          other:
            "{{count}} students with more failures than completions. View students.",
        },
      },
    },
    recent: {
      title: "Recent activity",
      description:
        "Most recent students with recorded activity.",
      empty:
        "There is no recorded activity yet.",
    },
  },
  teacherCourses: {
    common: {
      unavailable: "—",
    },
    header: {
      eyebrow: "Teacher supervision",
      title: "Courses",
      description:
        "Separate activity by semester and review only the students enrolled in each course.",
    },
    actions: {
      create: "Create course",
      creating: "Creating...",
      close: "Close",
      open: "Open",
      retry: "Retry",
    },
    metrics: {
      students: "Students",
      submissions: "Experiments",
      executions: "Executions",
    },
    summary: {
      aria: "Course summary",
      activeCourses: "Active courses",
      historicalCourses: "Historical courses",
      activeStudents: "Active students",
      registeredStudents:
        "Registered students",
    },
    create: {
      title: "New academic instance",
      description:
        "The same course code can exist in different years or semesters without mixing results.",
      code: "Code",
      codePlaceholder: "e.g. INF-221",
      name: "Name",
      namePlaceholder: "e.g. Data Structures",
      year: "Year",
      semester: "Semester",
      responsible:
        "Responsible instructor",
      selectResponsible:
        "Select a responsible instructor",
      loadingResponsibles:
        "Loading instructors...",
    },
    toolbar: {
      aria: "Course filters",
      active: "Active",
      historical: "Historical",
      searchLabel: "Search courses",
      searchPlaceholder: "Code, name, or instructor",
    },
    loading: "Loading courses",
    empty: {
      activeTitle: "There are no active courses yet",
      historyTitle: "There are no historical courses",
      activeDescription:
        "Create an academic instance to separate students and results by semester.",
      historyDescription:
        "Finished courses will appear here without losing their history.",
    },
    card: {
      active: "Active",
      finished: "Finished",
      teacherUnavailable: "Instructor unavailable",
      historicalStudents: "{{count}} historical students",
      registeredStudents: {
        one: "{{count}} registered student",
        other: "{{count}} registered students",
      },
      lastActivity: "Last activity: {{value}}",
    },
    list: {
      aria: "Course list",
    },
    errors: {
      loadTitle: "Could not load courses",
      load: "The courses could not be loaded.",
      create: "The course could not be created.",
      createValidation:
        "Check the course information and try again.",
      validationCode:
        "Enter a valid course code.",
      validationName:
        "Enter a valid course name.",
      validationYear:
        "Enter an academic year between 2000 and 9999.",
      validationTerm:
        "Select semester 1 or 2.",
      validationResponsible:
        "Select an active responsible instructor.",
      responsibles:
        "The responsible instructors could not be loaded.",
    },
  },

  teacherCourseDetail: {
    common: {
      unavailable: "—",
    },
    status: {
      courseActive: "Active",
      courseFinished: "Finished",
      membershipActive: "Active",
      membershipRemoved: "Removed",
    },
    attention: {
      failures:
        "More failures than completions",
      noExecutions: "No executions",
      none: "No alert",
    },
    enrollment: {
      notEligible:
        "Account unavailable for enrollment",
      rejectedGeneric:
        "Could not add",
      resultTitle:
        "Enrollment result",
      added: {
        one: "{{count}} added",
        other: "{{count}} added",
      },
      reactivated: {
        one: "{{count}} reactivated",
        other: "{{count}} reactivated",
      },
      alreadyActive: {
        one: "{{count}} already active",
        other: "{{count}} already active",
      },
      rejected: {
        one: "{{count}} rejected",
        other: "{{count}} rejected",
      },
    },
    actions: {
      back: "← Back to courses",
      export: "Export CSV",
      exporting: "Exporting...",
      edit: "Edit",
      closeEdit: "Close editing",
      finishCourse: "Finish course",
      reactivateCourse: "Reactivate course",
      save: "Save changes",
      saving: "Saving...",
      close: "Close",
      addStudents: "Add students",
      addToCourse: "Add to course",
      adding: "Adding...",
      viewProfile: "View profile",
      lastResult: "Latest result",
      remove: "Remove",
      restore: "Restore",
      previous: "Previous",
      next: "Next",
      cancel: "Cancel",
      cloneCourse: "Clone course",
    },
    export: {
      title:
        "Export all active students in the course",
      success:
        "CSV summary downloaded successfully.",
    },
    edit: {
      title: "Edit course",
      description:
        "Change the metadata for this academic instance.",
      code: "Code",
      name: "Name",
      year: "Year",
      semester: "Semester",
      responsible:
        "Responsible instructor",
      selectResponsible:
        "Select a responsible instructor",
      loadingResponsibles:
        "Loading instructors...",
    },
    students: {
      title: "Students",
      description:
        "Manage the course roster without deleting accounts or historical results.",
      addDisabledTitle:
        "Reactivate the course to add students.",
      emailLabel:
        "Student emails",
      emailPlaceholder:
        "student1@inf.udec.cl\nstudent2@inf.udec.cl\nstudent3@inf.udec.cl",
      help:
        "Paste a list separated by line breaks, spaces, commas, or semicolons. They must correspond to student accounts registered on the platform.",
      emailsDetected: {
        one: "{{count}} email detected",
        other:
          "{{count}} emails detected",
      },
      emailLimit:
        "The maximum is {{max}}. Reduce the list before continuing.",
      restoreSuccess:
        "The student was restored to the course.",
      membership: {
        active: "Active",
        inactive: "Removed",
        all: "All",
      },
      searchLabel:
        "Search students",
      searchPlaceholder:
        "Search by name or email",
      attentionFilterLabel:
        "Filter by attention",
      attentionFilter: {
        all: "All situations",
        noExecutions: "No executions",
        failures:
          "More failures than completions",
      },
      loading:
        "Loading students",
      emptyTitle:
        "No students to show",
      emptyDescription:
        "Adjust the filters or add students to the course.",
      table: {
        student: "Student",
        status: "Status",
        submissions: "Experiments",
        executions: "Executions",
        completed: "Completed",
        failed: "Failed",
        lastActivity:
          "Last activity",
        attention: "Attention",
        action: "Action",
      },
      noResultTitle:
        "This student does not have any completed results yet",
      count: {
        one: "{{count}} student",
        other: "{{count}} students",
      },
      page:
        "Page {{page}} of {{total}}",
    },
    confirm: {
      finishCourse:
        "Confirm finishing course {{code}} {{period}}?",
      reactivateCourse:
        "Confirm reactivating course {{code}} {{period}}?",
      removeStudent:
        "Remove {{name}} from the course? Their results will not be deleted.",
    },
    modals: {
      finish: {
        title: "Finish course",
      },
      reactivate: {
        title: "Reactivate course",
      },
      removeStudent: {
        title: "Remove student",
        description:
          "You will remove {{name}} ({{email}}) from the active roster.",
        preservedHistory:
          "The user account, experiments, and historical results will not be deleted.",
      },
    },
    clone: {
      title: "Clone course",
      description:
        "Create a new instance of {{code}} from period {{period}}.",
      copyStudents:
        "Copy active students",
      noActivityCopy:
        "Experiments, executions, and results will not be copied.",
    },
    loading: "Loading course",
    errors: {
      loadTitle:
        "Could not load the course",
      load:
        "The course could not be loaded.",
      updateCourse:
        "The course could not be updated.",
      saveCourse:
        "The course could not be saved.",
      addStudents:
        "Students could not be added.",
      removeStudent:
        "The student could not be removed.",
      restoreStudent:
        "The student could not be restored.",
      export:
        "The course summary could not be exported.",
      validationCode:
        "Enter a valid course code.",
      validationName:
        "Enter a valid course name.",
      validationYear:
        "Enter an academic year between 2000 and 9999.",
      validationTerm:
        "Select semester 1 or 2.",
      validationEmails:
        "Enter one or more valid student email addresses.",
      validationResponsible:
        "Select an active responsible instructor.",
      responsibles:
        "The responsible instructors could not be loaded.",
      cloneCourse:
        "The course could not be cloned.",
    },
  },

  teacherStudentDetail: {
    common: {
      unavailable: "—",
    },
    actions: {
      back: "← Back to course",
      retry: "Retry",
      previous: "Previous",
      next: "Next",
      viewDetail: "View details",
      close: "Close",
      viewExperiment:
        "View experiment",
      viewResults:
        "View results",
    },
    profile: {
      loading:
        "Loading student profile",
      errors: {
        title:
          "Could not load the profile",
        load:
          "The student profile could not be loaded.",
      },
      eyebrow:
        "Course student",
      membership: {
        active: "In course",
        removed: "Removed",
      },
      lastActivity:
        "Last activity",
      lastAccess:
        "Last access",
    },
    summary: {
      submissions: "Experiments",
      executions: "Executions",
      completed: "Completed",
      failed: "Failed",
      active: "Active",
    },
    tabs: {
      executions: "Executions",
      submissions: "Experiments",
    },
    states: {
      queued: "Queued",
      running: "Running",
      processing: "Processing",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    },
    pagination: {
      records: {
        one: "{{count}} record",
        other: "{{count}} records",
      },
      page:
        "Page {{page}} of {{total}}",
    },
    executions: {
      searchLabel:
        "Search executions",
      searchPlaceholder:
        "Experiment title",
      statusLabel: "Status",
      statusAll: "All",
      loading:
        "Loading executions",
      emptyTitle:
        "No executions in this course",
      emptyDescription:
        "No executions match the current filters.",
      errors: {
        title:
          "Could not load executions",
        load:
          "The executions could not be loaded.",
      },
      table: {
        execution: "Execution",
        source: "Source",
        submission: "Experiment",
        state: "Status",
        duration: "Duration",
        hardware: "Hardware",
        updated: "Updated",
        detail: "Details",
      },
      noCodename: "No codename",
      sourceFallback:
        "Source unavailable",
      submissionFallback:
        "Experiment #{{id}}",
    },

    modal: {
      eyebrow: "Technical details",
      title:
        "Execution #{{id}}",
      closeAria: "Close",
      loading:
        "Loading details",
      errors: {
        title:
          "Could not load the execution",
        load:
          "The execution details could not be loaded.",
      },
      summary: {
        source: "Source",
        submission: "Experiment",
        benchmark: "Benchmark",
        state: "Status",
        duration: "Duration",
      },
      configuration: {
        title: "Configuration",
        input: "Maximum input",
        samplesPerPoint:
          "Samples/point",
        points: "Points",
        warmup: "Warm-up",
        profile: "Profile",
        compilation: "Compilation",
      },
      hardware: {
        title:
          "Hardware and measurement",
        cpu: "CPU",
        architecture:
          "Architecture",
        logicalCpus:
          "Logical CPUs",
        backend: "Backend",
        scope: "Scope",
        result: "Result",
        available: "Available",
        unavailable:
          "Unavailable",
      },
      failure: {
        title:
          "Recorded failure",
        noCode: "No code",
        noMessage:
          "No additional message.",
      },
    },
    submissions: {
      searchLabel:
        "Search experiments",
      searchPlaceholder:
        "Experiment title",
      loading:
        "Loading experiments",
      emptyTitle:
        "No experiments in this course",
      emptyDescription:
        "This student does not have any experiments associated with this course instance yet.",
      errors: {
        title:
          "Could not load experiments",
        load:
          "The experiments could not be loaded.",
      },
      table: {
        submission: "Experiment",
        status: "Status",
        executions: "Exec.",
        completed: "Completed",
        failed: "Failed",
        active: "Active",
        created: "Created",
      },
      status: {
        noExecutions:
          "No executions",
        active:
          "Has active executions",
        completed: "Completed",
        failed: "Has failures",
        mixed: "Mixed",
        unknown:
          "No derived status",
      },
      fallback:
        "Experiment #{{id}}",
    },
  },

  adminCommon: {
    roles: {
      Student: "Student",
      Teacher: "Teacher",
      Admin: "Administrator",
      unknown: "No role",
    },
    accountStatus: {
      active: "Active",
      inactive: "Inactive",
      unknown: "Unknown",
    },
    executionStates: {
      all: "All",
      queued: "Queued",
      running: "Running",
      processing: "Processing",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
      unknown: "Unknown",
      none: "No executions",
    },
  },

  adminUsers: {
    preauthorize: {
      title: "Preauthorize user",
      description:
        "Enable an identity in advance so it can sign in with Google. It may be an @inf.udec.cl, @udec.cl, or external account.",
      open: "Preauthorize user",
      close: "Close",
      fullName: "Full name",
      email: "Exact email",
      role: "Initial role",
      submit: "Create preauthorization",
      submitting: "Creating…",
      help:
        "For external accounts, the email must exactly match an account that can authenticate with Google. Preauthorization does not create a password or link the identity until the first sign-in.",
      success:
        "User preauthorized successfully. They can now sign in with Google using that exact email.",
      validationRequired:
        "Complete the name and email before continuing.",
      emailExists:
        "That email already exists. Manage the role or access from the existing user.",
      emailConflict:
        "There is a normalization conflict for that email. Review existing users before continuing.",
      forbidden:
        "Only an administrator can preauthorize users.",
      error:
        "The preauthorization could not be created. Review the data and try again.",
    },
    header: {
      eyebrow: "Administration",
      title: "Users",
      description:
        "Manage accounts and review their recent activity in Performance System.",
    },
    summary: {
      aria: "User summary",
      total: "Total",
      totalCaption:
        "registered users",
      active: "Active",
      activeCaption:
        "with access enabled",
      inactive: "Inactive",
      inactiveCaption:
        "without access enabled",
      results: "Results",
      visible: "Visible",
      filteredCaption:
        "match the filters",
      visibleCaption:
        "available users",
    },
    filters: {
      search: "Search",
      searchPlaceholder:
        "Name or institutional email",
      role: "Role",
      roleAll: "All",
      status: "Status",
      statusAll: "All",
      sort: "Sort",
      sortRecent:
        "Recent activity",
      sortName: "Name",
      sortCreated:
        "Creation date",
      clear: "Clear",
    },
    table: {
      user: "User",
      role: "Role",
      account: "Account",
      activity: "Activity",
      lastExecution:
        "Latest execution",
      action: "Action",
    },
    loading: {
      title:
        "Loading users",
      description:
        "Querying the administrative user list.",
    },
    errors: {
      title:
        "Could not load users",
      network:
        "Could not connect to the service. Check your connection and try again.",
      session:
        "Your session expired. Sign in again.",
      forbidden:
        "Your account does not have permission to view this list.",
      service:
        "The service is temporarily unavailable. Try again in a few moments.",
      generic:
        "The user information could not be loaded. You can retry without leaving this page.",
    },
    actions: {
      retry: "Retry",
      viewUser: "View user",
      clearFilters:
        "Clear filters",
      previous: "Previous",
      next: "Next",
    },
    fallbacks: {
      name: "Unnamed user",
      email: "No email",
      unavailable: "—",
    },
    created:
      "Created {{date}}",
    activity: {
      submissions: {
        one: "{{count}} experiment",
        other: "{{count}} experiments",
      },
      executions: {
        one: "{{count}} execution",
        other: "{{count}} executions",
      },
      completed: {
        one: "{{count}} completed",
        other: "{{count}} completed",
      },
      failed: {
        one: "{{count}} failed",
        other: "{{count}} failed",
      },
      active: {
        one: "{{count}} active",
        other: "{{count}} active",
      },
    },
    empty: {
      title:
        "No users to show",
      filtered:
        "No users match the current filters.",
      unfiltered:
        "There are no registered users yet.",
    },
    pagination: {
      zero: "0 users",
      range:
        "{{first}}–{{last}} of {{total}}",
      rows: "Rows",
      pageSizeAria:
        "Number of users per page",
      page:
        "Page {{page}} of {{total}}",
    },
  },

  adminLayout: {
    navAria: "Administration sections",
    users: "Users",
    accessRequests: "Access requests",
    auditLog: "Audit log",
    systemStatus: "System status",
    pending: {
      one:
        "{{count}} pending access request",
      other:
        "{{count}} pending access requests",
    },
  },

  adminSystemStatus: {
    eyebrow: "Administration",
    title: "System status",
    description:
      "Verifiable operational signals observed by the backend. This view does not replace a monitoring platform.",
    unavailable: "Unavailable",
    actions: {
      refresh: "Refresh",
      refreshing: "Refreshing…",
      retry: "Retry",
    },
    states: {
      loadingTitle: "Checking status",
      loadingDescription:
        "Persisted signals and safe configuration are being read.",
      errorTitle: "The diagnostic could not be refreshed",
      errorDescription:
        "The system status could not be retrieved.",
    },
    sections: {
      system: "System",
      queue: "Execution queue",
      processes: "Auxiliary processes",
      runtime: "Operational configuration",
      measurement: "Latest observed measurement environment",
    },
    system: {
      backend: "Backend",
      database: "PostgreSQL",
      checkedAt: "Checked at",
    },
    statuses: {
      AVAILABLE: "Available",
      UNAVAILABLE: "Unavailable",
      UNKNOWN: "Unknown",
    },
    lockSignals: {
      LOCK_OBSERVED: "Lock observed",
      LOCK_NOT_OBSERVED: "Lock not observed",
      UNKNOWN: "Unknown",
    },
    queue: {
      queued: "Queued",
      running: "Running",
      processing: "Processing",
      staleActive: "Stale active",
      oldestQueuedAt: "Oldest queued",
      latestCompletedAt: "Latest completed",
      latestFailedAt: "Latest failed",
      failedHelper:
        "A failed Execution may be caused by submitted code and does not imply a global system failure.",
    },
    processes: {
      dispatcher: "Dispatcher",
      watchdog: "Watchdog",
      lockHelper:
        "An advisory lock is a point-in-time coordination signal: it does not guarantee progress and is not a health check.",
    },
    runtime: {
      executionMode: "Execution mode",
      heartbeatSeconds: "Heartbeat (seconds)",
      activeStaleSeconds: "Stale threshold (seconds)",
      helper:
        "Configuration values observed by the backend for this request.",
    },
    modes: {
      local: "Local",
      remote: "Remote",
      unknown: "Unknown",
    },
    measurementNodes: {
      title: "Registered measurement nodes",
      helper:
        "Operational state derived from enablement, active profile, heartbeat, and draining. This inventory is separate from the historical execution snapshot shown below.",
      inventoryStatus: "Inventory",
      empty: "No measurement nodes are registered.",
      unavailable:
        "The measurement-node inventory is unavailable for this refresh.",
      cardAria: "Measurement node {{name}}",
      hardwareProfile: "Hardware profile",
      enabled: "Enabled",
      draining: "Draining mode",
      validationOnly: "Validation only",
      lastHeartbeatAt: "Last heartbeat",
      heartbeatAgeSeconds: "Heartbeat age",
      states: {
        AVAILABLE: "Available",
        OFFLINE: "Offline",
        DRAINING: "Draining",
      },
    },
    measurement: {
      historicalWarning:
        "These data are historical, come from the latest Execution with a valid snapshot, and do not represent live health.",
      observedAt: "Observed at",
      schemaVersion: "Snapshot schema",
      cpuModel: "CPU model",
      architecture: "Architecture",
      logicalCpus: "Logical CPUs",
      perfVersion: "perf version",
      perfEventParanoid: "perf_event_paranoid",
      energyPackage: "Package energy",
      energyCores: "Cores energy",
      energyRam: "RAM energy",
      eventExposed: "Event exposed",
      probeState: "Probe state",
      measurementAvailable: "Measurement available",
    },
    boolean: {
      yes: "Yes",
      no: "No",
    },
    probeStates: {
      numeric: "Numeric sample",
      permission_denied: "Permission denied",
      not_supported: "Not supported by perf",
      not_counted: "Not counted",
      event_not_exposed: "Event not exposed",
      backend_error: "Measurement backend error",
      no_numeric_sample: "No numeric sample",
    },
  },

  adminUserDetail: {
    fallbacks: {
      name: "Unnamed user",
      email: "No email",
      unavailable: "—",
    },
    actions: {
      back:
        "← Back to users",
      retry: "Retry",
      clearFilters:
        "Clear filters",
      previous: "Previous",
      next: "Next",
      viewDetail:
        "View details",
      clearSearch:
        "Clear search",
      close: "Close",
      viewExperiment:
        "View experiment",
      viewResults:
        "View results",
      cancel: "Cancel",
      promoteTeacher:
        "Promote to Teacher",
      changeToStudent:
        "Change to Student",
    },
    header: {
      eyebrow:
        "Administration",
      title:
        "User details",
      description:
        "Profile, experiments, executions, and administrative activity.",
    },
    loading: {
      title:
        "Loading user",
      description:
        "Querying profile and activity.",
    },
    errors: {
      title:
        "Could not load user",
      load:
        "The user profile could not be loaded.",
      network:
        "Could not connect to the service. Check your connection and try again.",
      session:
        "Your session expired. Sign in again.",
      forbidden:
        "Your account does not have permission to view this user.",
      notFound:
        "The requested user is not available.",
      service:
        "The service is temporarily unavailable. Try again in a few moments.",
      changeRole:
        "The user role could not be changed.",
    },
    profile: {
      created: "Created",
      lastLogin:
        "Last session",
      lastActivity:
        "Last execution",
    },
    accessChange: {
      title: "Access management",
      description:
        "Revoke or reactivate global access without deleting the account or its history.",
      activeDescription:
        "The account is active. Revoking access will invalidate its active sessions.",
      inactiveDescription:
        "The account is inactive. Reactivating it will allow a new sign-in without restoring previous sessions.",
      revokeAction: "Revoke access",
      reactivateAction: "Reactivate access",
      revokeModalTitle:
        "Confirm access revocation",
      reactivateModalTitle:
        "Confirm access reactivation",
      revokeDescription:
        "Access for {{name}} will be revoked. Active sessions will be closed, while identity and history will be preserved.",
      reactivateDescription:
        "Access for {{name}} will be reactivated. They will need to sign in again with Google.",
      pendingRequestError:
        "This user has a pending UdeC access request. Resolve it from Access requests before reactivating the account.",
      error:
        "The user's access could not be updated.",
    },
    roleChange: {
      title: "Role management",
      description:
        "Change between Student and Teacher with the corresponding academic safeguards.",
      modalTitle:
        "Confirm role change",
      promoteDescription:
        "You will promote {{name}} ({{email}}) to the Teacher role.",
      demoteDescription:
        "You will change {{name}} ({{email}}) to the Student role. The operation will be blocked if any courses remain assigned.",
      assignedCoursesError:
        "Assigned courses: {{count}}. Transfer them before changing the role.",
    },
    summary: {
      submissions:
        "Experiments",
      executions: "Executions",
      completed: "Completed",
      failed: "Failed",
      active: "Active",
    },
    tabs: {
      aria:
        "Administrative details",
      executions:
        "Executions",
      submissions:
        "Experiments",
      audit: "Activity",
    },
    pagination: {
      zero: "0 records",
      range:
        "{{first}}–{{last}} of {{total}}",
      page:
        "Page {{page}} of {{total}}",
    },
    executions: {
      title: "Executions",
      description:
        "Technical history based on canonical execution states.",
      kpis: {
        completed:
          "completed",
        failed: "failed",
        active: "active",
      },
      searchLabel:
        "Search experiments",
      searchPlaceholder:
        "E.g. LCS, SIZE, CAMMR...",
      statusLabel: "Status",
      errors: {
        title:
          "Could not load executions",
        load:
          "The executions could not be loaded.",
      },
      loading: {
        title:
          "Loading executions",
        description:
          "Querying the user's execution history.",
      },
      empty: {
        title:
          "No executions to show",
        filtered:
          "No executions match the current filters.",
        unfiltered:
          "This user does not have any registered executions yet.",
      },
      table: {
        execution: "Execution",
        source: "Source",
        submission: "Experiment",
        state: "Status",
        duration: "Duration",
        hardware: "Hardware",
        updated: "Updated",
        detail: "Details",
      },
      noCodename:
        "No codename",
      sourceFallback:
        "Source unavailable",
      submissionFallback:
        "Experiment #{{id}}",
    },
    submissions: {
      title: "Experiments",
      description:
        "The user's experiments and the distribution of their executions.",
      total:
        "{{count}} total",
      searchLabel:
        "Search experiments",
      searchPlaceholder:
        "Experiment title",
      errors: {
        title:
          "Could not load experiments",
        load:
          "The experiments could not be loaded.",
      },
      loading: {
        title:
          "Loading experiments",
        description:
          "Querying the user's experiments.",
      },
      empty: {
        title:
          "No experiments to show",
        filtered:
          "No experiments match the current search.",
        unfiltered:
          "This user does not have any registered experiments yet.",
      },
      table: {
        submission: "Experiment",
        status: "Status",
        executions: "Executions",
        completed: "Completed",
        failed: "Failed",
        active: "Active",
        created: "Created",
      },
      status: {
        approved: "Approved",
        errors:
          "Recurring errors",
        mixed: "Mixed",
        review: "In review",
      },
      fallback:
        "Experiment #{{id}}",
    },
    audit: {
      title: "Activity",
      description:
        "Persisted audit-log actions for this user.",
      total:
        "{{count}} events",
      errors: {
        title:
          "Could not load activity",
        load:
          "The action history could not be loaded.",
      },
      loading: {
        title:
          "Loading activity",
        description:
          "Querying the audit log.",
      },
      empty: {
        title:
          "No recorded activity",
        description:
          "There are no audit events associated with this user.",
      },
      fallbackAction: "Action",
      fallbackDescription:
        "No description recorded.",
    },
    modal: {
      eyebrow:
        "Technical details",
      title:
        "Execution #{{id}}",
      closeAria:
        "Close details",
      loading: {
        title:
          "Loading details",
        description:
          "Querying the canonical execution.",
      },
      errors: {
        title:
          "Could not load details",
        load:
          "The execution details could not be loaded.",
      },
      summary: {
        source: "Source",
        submission: "Experiment",
        benchmark: "Benchmark",
        state: "Status",
        duration: "Duration",
      },
      submissionFallback:
        "Experiment #{{id}}",
      configuration: {
        title: "Configuration",
        input: "Maximum input",
        samplesPerPoint:
          "Samples/point",
        points: "Points",
        warmup: "Warm-up",
        profile: "Profile",
        compilation: "Compilation",
      },
      hardware: {
        title:
          "Hardware and measurement",
        cpu: "CPU",
        architecture:
          "Architecture",
        logicalCpus:
          "Logical CPUs",
        backend: "Backend",
        scope: "Scope",
        result: "Result",
        available: "Available",
        unavailable:
          "Unavailable",
      },
      failure: {
        title:
          "Recorded failure",
        noCode: "No code",
        unknownStage:
          "Unknown stage",
        noMessage:
          "No additional message.",
      },
      timestamps: {
        started:
          "Started {{date}}",
        processing:
          "Processing {{date}}",
        finished:
          "Finished {{date}}",
      },
    },
  },

  commonErrors: {
    network:
      "Could not connect to the server. Check that the backend is available and try again.",
    session:
      "Your session expired. Sign in again to continue.",
    forbidden:
      "Your account does not have permission to perform this action.",
    notFound:
      "The requested resource is not available.",
    service:
      "The service is temporarily unavailable. Try again in a few moments.",
    generic:
      "The request could not be completed. Try again.",
    conflict:
      "The request has already been resolved.",
  },

  adminAccessRequests: {
    header: {
      eyebrow:
        "Administration",
      title:
        "Access requests",
      description:
        "Review and resolve institutional access requests.",
    },
    summary: {
      aria:
        "Access request summary",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
    },
    filters: {
      search: "Search",
      searchPlaceholder:
        "Name, email, or course",
      status: "Status",
    },
    status: {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      pendingPlural:
        "Pending",
      approvedPlural:
        "Approved",
      rejectedPlural:
        "Rejected",
      all: "All",
    },
    table: {
      user: "User",
      course:
        "Course / professor",
      comment: "Comment",
      status: "Status",
      date: "Date",
      action: "Action",
    },
    loading: {
      title:
        "Loading requests",
    },
    errors: {
      title:
        "Could not load access requests",
      load:
        "The access requests could not be loaded.",
      resolve:
        "The access request could not be processed.",
    },
    empty: {
      title:
        "No access requests to show",
    },
    actions: {
      retry: "Retry",
      approve: "Approve",
      reject: "Reject",
      cancel: "Cancel",
      previous: "Previous",
      next: "Next",
    },
    modal: {
      approveTitle:
        "Approve access request #{{id}}",
      rejectTitle:
        "Reject access request #{{id}}",
      approveDescription:
        "Confirm approval of this institutional access request.",
      rejectDescription:
        "Confirm rejection of this institutional access request.",
      user: "User",
      course: "Course",
      professor:
        "Responsible professor",
      rejectReason:
        "Rejection reason (optional)",
      rejectReasonPlaceholder:
        "Add context for this decision",
    },
    resolution: {
      resolved: "Resolved",
      emailSent:
        "Access request approved and notification email sent.",
      emailFailed:
        "Access request approved. The notification email could not be sent.",
      emailDisabled:
        "Access request approved. Email delivery is not enabled in this environment.",
    },
    pagination: {
      requests: {
        one:
          "{{count}} request",
        other:
          "{{count}} requests",
      },
      page:
        "Page {{page}} of {{total}}",
    },
    fallbacks: {
      unavailable: "—",
      unknownStatus:
        "Unknown status",
    },
  },

  adminAuditLog: {
    header: {
      eyebrow:
        "Administration",
      title:
        "Audit log",
      description:
        "Persistent record of administrative actions.",
    },
    filters: {
      action: "Action",
      allActions:
        "All actions",
      from: "From",
      to: "To",
    },
    actionLabels: {
      approveAccessRequest:
        "Access request approved",
      rejectAccessRequest:
        "Access request rejected",
      createCourse:
        "Course created",
      updateCourse:
        "Course updated",
      transferCourseTeacher:
        "Course responsibility transferred",
      cloneCourse:
        "Course cloned",
      addCourseStudents:
        "Student batch processed",
      removeCourseStudent:
        "Student removed from course",
      restoreCourseStudent:
        "Student restored to course",
      rerunSubmission:
        "Experiment rerun requested",
      createExperimentalProtocol:
        "Experimental protocol created",
      updateExperimentalProtocol:
        "Experimental protocol updated",
      publishExperimentalProtocol:
        "Experimental protocol published",
      deactivateExperimentalProtocol:
        "Experimental protocol deactivated",
      changeUserRole:
        "User role changed",
      unknown:
        "Unknown action",
    },
    loading: {
      title:
        "Loading audit log",
    },
    errors: {
      title:
        "Could not load the audit log",
      load:
        "The audit log could not be loaded.",
    },
    empty: {
      title:
        "No events to show",
    },
    actions: {
      clear: "Clear",
      retry: "Retry",
      previous: "Previous",
      next: "Next",
    },
    pagination: {
      events: {
        one: "{{count}} event",
        other:
          "{{count}} events",
      },
      page:
        "Page {{page}} of {{total}}",
    },
    fallbacks: {
      action: "Action",
      description:
        "No description recorded.",
      user:
        "User unavailable",
      unavailable: "—",
    },
  },

  tutorialPage: {
    v9: {
      screenshot: {
        expandAria: "Enlarge screenshot: {{alt}}",
        zoom: "Enlarge",
      },
      hero: {
        eyebrow: "User guide",
        title: "From code to performance evidence",
        subtitle:
          "Upload C or C++ implementations, configure the experiment, run reproducible measurements, and analyze the results.",
        featuresAria: "Guide features",
        badges: {
          controlled: "Controlled measurement environment",
          reproducible: "Reproducible and comparable results",
        },
      },
      navigation: {
        aria: "Guide stages",
        create: "Create an experiment",
        results: "Understand results",
        compare: "Recover and compare",
        supervise: "Supervise a course",
      },
      observation: {
        title: "What to observe",
      },
      create: {
        kicker: "Create an experiment",
        title: "From a ZIP to independent executions",
        description:
          "An experiment groups implementations under a common configuration. Each supported source is compiled, measured, and preserved as an independent execution.",
        contract: {
          aria:
            "An experiment ZIP contains algorithm dot c and algorithm dot cpp; each source produces its own execution and result.",
          experiment: "Experiment ZIP",
          container: "Implementation container",
          execution: "Execution",
          result: "Result",
        },
        independent: {
          title: "One source, one execution",
          text:
            "1 supported source → 1 Execution → 1 executable → 1 set of measurements and results.",
        },
        shared: {
          title: "Shared experimental context",
          text:
            "Implementations in the experiment share the benchmark, input sizes, repetitions, and base configuration to support a traceable interpretation.",
        },
        mixed: {
          title: "C, C++, or mixed",
          text:
            ".c sources use gcc, .cpp sources use g++, and one ZIP may contain both languages.",
        },
        operational: {
          detailsSummary: "View technical details",
          detailsDescription:
            "AUTO, operating ranges, and measurement-node availability.",
          auto: {
            title: "AUTO is the recommended option",
            text:
              "AUTO selects an eligible measurement node while keeping a single physical measurement active. PINNED is an advanced option to explicitly fix a node; it is not used to choose the most powerful hardware.",
          },
          policy: {
            title: "The policy defines the executable range",
            text:
              "Benchmark and profile determine the minimum, initial value, recommended range, operational maximum, step, and timeout. The interface guides the configuration, but the backend validates it again before accepting execution.",
          },
          availability: {
            title: "Busy does not mean unavailable",
            text:
              "If an operational node exists but is busy, the job can be accepted and wait in the FIFO queue. If no eligible node is available, the system blocks new physical measurements until the environment recovers.",
          },
        },
        academic: {
          title: "Course, personal analysis, and protocols",
          text:
            "A student can associate the experiment with an active course or explicitly choose a personal analysis. With a single course, that context is proposed by default without removing the personal option.",
          protocol:
            "Protocols published by a teacher prepare a reusable academic configuration. The analysis remains editable and the current operational policy is validated when creating, updating, publishing, and executing.",
          protocolCta: "Open Protocols",
        },
        noLinking: {
          title: "The ZIP is not a multi-file project",
          text:
            "Sources are not linked together. Do not use main.c + helper.c as one program or include Make, CMake, or dependent translation units.",
        },
        newAnalysis: {
          alt:
            "New analysis form with a recognized mixed C and C++ ZIP",
          caption:
            "Before execution, the summary confirms the detected sources and experiment configuration.",
          points: {
            summary:
              "The ec01_mixed_golden_post8c.zip archive is recognized as 2 sources · 1 C · 1 C++.",
            sources:
              "The summary preserves the names of both implementations.",
            ready:
              "Benchmark, operational policy, academic context, measurement mode, and availability remain visible before execution.",
          },
        },
        mixedExecutions: {
          alt:
            "Mixed experiment detail with one C execution and one C++ execution",
          caption:
            "Each source preserves its own language, compiler, execution, and result.",
          points: {
            c: "size_fixture.c appears as C · gcc.",
            cpp: "size_fixture.cpp appears as C++ · g++.",
            independent:
              "Measurements from one implementation are not mixed with the other.",
            actions:
              "From each execution you can open code, reuse configuration, compare, or review the result.",
          },
        },
      },
      examples: {
        kicker: "Downloadable examples",
        title: "Three valid ways to prepare an experiment",
        description:
          "The public URLs remain unchanged. Each ZIP follows its benchmark input and output contract and demonstrates one mode supported by the product.",
        observeLabel: "What to observe",
        download: "Download {{benchmark}} example",
        prepare: "Prepare analysis",
        contractNote:
          "Each .c or .cpp file is a standalone implementation with its own entry point. The ZIP files contain no headers, build systems, or unsupported sources.",
        modes: {
          mixed: "Mixed C + C++",
          c: "C",
          cpp: "C++",
        },
        size: {
          title: "Insertion Sort vs. Merge Sort",
          description:
            "A mixed experiment with two algorithms that generate the same deterministic data set from size N.",
          observe:
            "Compare how time and instructions change between insertion_sort.c and merge_sort.cpp as N grows.",
        },
        lcs: {
          title: "Longest Common Subsequence",
          description:
            "A C implementation using dynamic programming over the lines in the file supplied by the benchmark.",
          observe:
            "Relate work growth to the number of processed lines and the dynamic-programming table.",
        },
        camm: {
          title: "Blocked matrix multiplication",
          description:
            "A C++ implementation that processes the numeric values supplied as arguments by the benchmark.",
          observe:
            "Review time, instructions, and cache behavior as the input grows.",
        },
      },
      results: {
        kicker: "Understand results",
        title: "Read measured evidence first",
        description:
          "A result combines experimental context, indicators, trends, and interpretation. Exact metric availability depends on the hardware and measurement backend.",
        evidence: {
          title: "Measurements are the primary source",
          text:
            "Begin with values and units, continue with deterministic interpretation based on reproducible rules, and use AI assistance only as a complement.",
        },
        flow: {
          aria: "Pedagogical order for interpreting a result",
          context: "Experimental context",
          indicators: "Primary indicators",
          trends: "Trends and charts",
          deterministic: "Deterministic interpretation",
          ai: "Complementary AI assistance",
          reproducibility: "Reproducibility",
        },
        metrics: {
          title: "Metric families",
          description:
            "The system presents only families backed by observed series. Energy appears only when the environment can expose it.",
          time: {
            title: "Execution time",
            text:
              "Describes how long the implementation takes for each size and repetition under the selected configuration.",
          },
          instructions: {
            title: "Instructions and IPC",
            text:
              "Relates processor-retired work to observed cycles and execution efficiency.",
          },
          cache: {
            title: "Cache and branch prediction",
            text:
              "Provides context through cache and branch-prediction misses when those counters are available.",
          },
          energy: {
            title: "Energy",
            text:
              "Shown only when the hardware and backend provide a valid series.",
          },
        },
        overview: {
          alt:
            "Results view with experimental context, indicators, and guided interpretation",
          caption:
            "Context and indicators precede the guided interpretation of trends.",
          points: {
            context: "The header identifies the benchmark and environment.",
            configuration:
              "Maximum size and repetitions delimit the experimental context.",
            kpis:
              "Visible KPIs include Time, IPC, Cache miss, Branch miss, and Instructions.",
            interpretation:
              "Guided interpretation begins after the quantitative evidence.",
          },
        },
        reproducibility: {
          alt:
            "Reproducibility panel for a C source with provenance and observed toolchain",
          caption:
            "Declared configuration and observed environment are presented as distinct traceability layers.",
          points: {
            source:
              "The size_fixture.c source is identified as C with explicit v2 provenance.",
            declared:
              "The configuration declares gcc and -O3 flags.",
            hardware:
              "The snapshot records the hardware observed during measurement.",
            observed:
              "The trace confirms the perf backend, gcc compiler, and observed version.",
          },
        },
        provenance: {
          declared: {
            label: "Declared configuration",
            title: "What was requested before execution",
            text:
              "Language, compiler, and flags form the reproducible contract configured for the source.",
          },
          observed: {
            label: "Observed environment",
            title: "What was recorded during execution",
            text:
              "The trace and snapshot document the backend, actual compiler version, and observed hardware.",
          },
        },
      },
      compare: {
        kicker: "Recover and compare",
        title: "Return to the evidence and assess compatibility",
        description:
          "History preserves experiments and executions so you can recover results, repeat configurations, mark references, and build auditable comparisons.",
        history: {
          alt:
            "History with C, mixed C and C++, and C++ experiments",
          caption:
            "Each experiment shows its sources, benchmark, status, and recovery actions.",
          points: {
            experiments:
              "History distinguishes C, mixed C/C++, and C++ experiments.",
            sources:
              "Sources, benchmark, and status help identify the correct evidence.",
            actions:
              "From here you can recover, repeat, mark a reference, or compare.",
          },
        },
        compatibility: {
          title: "Three states, three different decisions",
          description:
            "Compatibility summarizes relevant conditions; it does not replace reviewing metrics, warnings, and blockers.",
          compatible: {
            title: "Compatible",
            text:
              "Relevant conditions are aligned and direct comparison is allowed.",
          },
          limited: {
            title: "Limited",
            text:
              "Differences require caution, but comparable metrics remain visible. C/gcc versus C++/g++ is the canonical example.",
          },
          incompatible: {
            title: "Incompatible",
            text:
              "A blocker prevents treating the comparison as valid under the current scientific contract.",
          },
        },
        evidence: {
          title: "LIMITED does not mean INCOMPATIBLE",
          text:
            "A language or toolchain difference must produce a warning, not hide time, IPC, cache, or branch evidence when the series and other conditions remain comparable.",
        },
        comparison: {
          alt:
            "Limited comparison between a C execution with gcc and a C++ execution with g++",
          caption:
            "The toolchain warning coexists with metrics that preserve valid common evidence.",
          points: {
            toolchains: "The comparison identifies C/gcc and C++/g++.",
            coverage: "Four of five target metrics are comparable.",
            visible: "Time, IPC, cache, and branch remain visible.",
            energy:
              "Energy is marked not comparable when no valid common series exists.",
          },
        },
      },
      teacher: {
        kicker: "Supervise a course",
        title: "Turn operational signals into academic attention",
        description:
          "Supervision helps locate cases that need review without turning system activity into a grade.",
        screenshot: {
          alt:
            "Teacher course supervision with academic attention and student activity",
          caption:
            "The view brings together course signals and access to each student's detail.",
        },
        points: {
          attention: "Academic attention gathers cases that need review.",
          noExecutions: "Students without executions are identified.",
          failures: "Predominant failures guide diagnosis.",
          activity: "Recent activity provides operational context.",
          students:
            "The list opens the student record and latest available result.",
        },
        protocols: {
          title: "Course experimental protocols",
          text:
            "Teachers can create, edit, publish, and deactivate reusable configurations to guide course analyses. A protocol is not bound to a specific node.",
          policy:
            "Input size stays aligned with the current AUTO policy for the selected benchmark and profile; if that policy is unavailable, existing protocols remain reviewable while creating or saving an invalid configuration is blocked.",
        },
        guardrail:
          "These are operational signals for reviewing cases, without grading or comparing students. They are not rankings or scores.",
        cta: "Open Supervision",
      },
      final: {
        kicker: "Next step",
        title: "Keep context alongside every measurement",
        description:
          "Prepare standalone sources, review policy, availability, and academic context before execution, and return to History to interpret or compare results under explicit conditions.",
        newAnalysis: "Go to New analysis",
        history: "Open History",
      },
      lightbox: {
        aria: "Enlarged guide screenshot",
        closeAria: "Close enlarged screenshot",
      },
    },
    screenshot: {
      expandAria: "Enlarge screenshot: {{alt}}",
      zoom: "Enlarge",
    },
    hero: {
      eyebrow: "User guide",
      title: "How Performance System works",
      subtitle:
        "From uploading code to interpreting results: a short guide to running reproducible measurements of C++ / .cpp algorithms.",
      featuresAria: "Features",
      badges: {
        controlled: "Controlled execution",
        performance: "Performance metrics",
        visualization: "Visualization and analysis",
      },
    },
    flow: {
      kicker: "Main flow",
      title: "From your code to an interpretable measurement",
      description:
        "The system separates experiment preparation, execution, and result presentation so that each stage remains traceable.",
      visualReferenceLabel: "Visual reference:",
      visualReferenceText:
        "the current screenshots show the Spanish interface and were captured in dark mode. Control locations and behavior are equivalent in English and light mode.",
      step1: {
        title: "Prepare and upload your project",
        description:
          "Upload a ZIP file containing your C++ (.cpp) implementation. Performance System validates the archive before adding it to the experiment.",
        shot: {
          alt: "ZIP file selected in the new analysis form",
          caption:
            "The selected file must contain at least one .cpp source file.",
        },
      },
      step2: {
        title: "Configure the analysis",
        description:
          "Select the available benchmark, input size, repetitions per point, and the execution profile you need.",
        profileShot: {
          alt: "Measurement environment and profile selection",
          caption:
            "The profile controls how many times each point is repeated.",
        },
        summaryShot: {
          alt: "Complete experiment summary ready to review and run",
          caption:
            "The summary lets you verify the parameters before running the experiment.",
        },
      },
      step3: {
        title: "Submit and follow the execution",
        description:
          "After confirming the configuration, the job enters the queue and progresses through controlled states while it is compiled, executed, measured, and processed.",
        overviewShot: {
          alt: "View of a registered execution waiting in the queue",
          caption:
            "The active stage is distinguished from work that has already completed.",
        },
        detailsShot: {
          alt:
            "View of an execution taking measurements and showing technical details",
          caption:
            "Technical details let you follow messages from the process.",
        },
      },
      step4: {
        title: "Interpret the results",
        description:
          "When the execution finishes, review the available metrics, their charts, and the explanations that help interpret the observed behavior.",
        shot: {
          alt:
            "Summary of a completed execution with key indicators and guided interpretation",
          caption:
            "The header preserves the configuration and summarizes the latest measured point.",
        },
      },
    },
    zip: {
      kicker: "Before running",
      title: "Prepare the ZIP correctly",
      description:
        "The compressed file must contain the source code you want to measure. The platform validates the ZIP before registering the experiment to prevent unexpected formats or files that cannot be processed.",
      exampleAria: "ZIP example",
      note:
        "Do not include absolute paths, symbolic links, or content unrelated to the test. If the ZIP does not pass validation, the system will reject it before running the experiment.",
    },
    configuration: {
      kicker: "Configuration",
      title: "What each parameter controls",
      benchmark:
        "Defines the input type and scenario used to evaluate the code.",
      inputSizeLabel: "Input size",
      inputSize:
        "Determines the scale of the problem used during measurement.",
      repetitionsLabel: "Repetitions per point",
      repetitions:
        "Indicates how many times each input size is measured to obtain more stable results.",
      profileLabel: "Profile",
      profile:
        "Groups execution settings designed for quick, balanced, or more exhaustive analyses.",
    },
    examples: {
      kicker: "Examples to get started",
      title: "Classic algorithms ready to measure",
      description:
        "Download a ZIP, inspect its code, and upload it from New analysis. Each example follows its benchmark input contract and is designed to produce an interpretable trend.",
      observeLabel: "What to observe",
      download: "Download {{benchmark}} example",
      sizeNote:
        "The SIZE example contains two .cpp files. Performance System registers them as independent implementations within the same experiment, so you can compare them later without mixing their measurements.",
      size: {
        title: "Insertion Sort vs. Merge Sort",
        description:
          "Two classic sorting algorithms receive exactly the same size N and generate the same deterministic data set.",
        observe:
          "Compare how time and instructions change as N grows, then open the comparison between both implementations.",
      },
      lcs: {
        title: "Longest Common Subsequence",
        description:
          "Classic dynamic-programming implementation over two sequences built from the lines in the text file supplied by the benchmark.",
        observe:
          "Observe how the work grows as the number of processed lines increases and relate the trend to the dynamic-programming table.",
      },
      camm: {
        title: "Blocked matrix multiplication",
        description:
          "Classic matrix multiplication organized in blocks to operate on the numeric values supplied through the benchmark arguments.",
        observe:
          "Review time, instructions, and available cache metrics as the amount of input data increases.",
      },
    },
    states: {
      kicker: "Tracking",
      title: "Execution states",
      description:
        "An execution keeps a persistent state so you can leave the view and return later to check its progress.",
      items: {
        queued: {
          name: "Queued",
          description:
            "The execution was registered and is waiting for a measurement resource.",
        },
        running: {
          name: "Running",
          description:
            "The code is compiled and/or executed in the measurement environment.",
        },
        processing: {
          name: "Processing",
          description:
            "Performance System transforms the measurements into queryable results.",
        },
        completed: {
          name: "Completed",
          description:
            "The results are available for review.",
        },
      },
      failure: {
        title: "What if something fails?",
        description:
          "Validation, compilation, execution, measurement, or processing errors are presented as an execution failure. The available detail helps identify the stage that requires correction.",
      },
    },
    continuity: {
      kicker: "Continuity",
      title: "Resume your latest result from your profile",
      description:
        "The execution remains persisted even if you leave the tracking screen. From your profile, you can review your activity status and open the most recent result directly.",
      lastResultLabel: "View latest result",
      lastResultDescription:
        "opens the visualization for the most recent completed execution; it does not run the code again or alter stored measurements.",
      shot: {
        alt:
          "Student profile with activity summary and access to the latest result",
        caption:
          "The shortcut is located in the Latest execution card.",
      },
    },
    results: {
      kicker: "Results",
      title: "What you can observe",
      description:
        "Exact availability depends on the execution, profile, and measurement hardware. Performance System only shows metrics that are actually available.",
      metrics: {
        time: {
          title: "Time",
          text:
            "Shows how long the implementation takes under the selected configuration.",
        },
        cpu: {
          title: "CPU",
          text:
            "Includes available processor events and counters for studying the work performed by the algorithm.",
        },
        memory: {
          title: "Memory",
          text:
            "Helps contextualize resource usage and the behavior of the implementation.",
        },
        energy: {
          title: "Energy",
          text:
            "Shown when the hardware and measurement environment can obtain it reliably.",
        },
      },
      example: {
        kicker: "Reading example",
        title: "Relate input size to the trend",
        description:
          "In this example, the horizontal axis represents input size and the vertical axis execution time. Each point summarizes the repetitions performed for that size: focus on the overall direction of the series rather than an isolated point.",
        points: {
          unit: "Always check the unit shown on each axis.",
          trend:
            "Observe whether the metric increases, decreases, or remains stable.",
          compare:
            "Only compare executions performed under equivalent conditions.",
        },
        shot: {
          alt: "Execution-time chart by input size",
          caption:
            "The series shows an increasing trend across the measured sizes.",
        },
      },
    },
    interpretation: {
      kicker: "Interpretation",
      title: "How to read a measurement",
      description:
        "A chart should not be analyzed in isolation. Observe the trend, compare executions under equivalent conditions, and use the system explanations as support for relating metrics to algorithm behavior.",
      preview: {
        trend: "Observed trend",
        metrics: "Comparison across metrics",
        implementation: "Implementation context",
      },
    },
    goodPractices: {
      kicker: "Good practices",
      title: "Obtain comparable results",
      items: {
        sameConfig:
          "Compare implementations using the same input configuration and number of repetitions.",
        externalProcesses:
          "Avoid unnecessary external processes during measurement when working in a local test environment.",
        repetitions:
          "Use several repetitions per point to reduce the effect of isolated variations.",
        jointInterpretation:
          "Interpret metrics together: an improvement in one metric does not necessarily imply an overall improvement.",
      },
    },
    final: {
      kicker: "Before you begin",
      title: "Review the ZIP and preserve comparable conditions",
      description:
        "Once the file is ready, configure the benchmark and verify the summary before running it. When repeating a comparison, keep the same environment, profile, and input size so the interpretation remains valid.",
    },
    lightbox: {
      aria: "Enlarged tutorial screenshot",
      closeAria: "Close enlarged screenshot",
    },
  },
};

export default en;
