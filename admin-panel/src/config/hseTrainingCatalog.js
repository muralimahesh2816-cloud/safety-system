// HSE training concept catalogue.
//
// This is *reference content*, not a replacement for the Training collection.
// Uploaded trainings remain the system of record — every record the backend
// returns is shown exactly as before. This catalogue supplies the safety
// curriculum the portal should be able to teach against: the concepts, the
// hazards, and the right-vs-wrong practice pairs for each one.
//
// It is data, deliberately, rather than JSX. A Safety Manager can extend it
// without touching a component, the same shape is what `POST /training`
// accepts, and the "Create from catalogue" action in the Training module
// pre-fills the upload form straight from an entry here.
//
// Shape of a concept:
//   id                 stable slug, also used as the pre-fill key
//   title              concept name
//   category           top-level category key (see CATEGORIES)
//   duration           nominal delivery time in minutes
//   objective          what the learner must be able to do afterwards
//   concept            one-line summary printed on the certificate
//   hazards[]          what can hurt someone
//   correctPractice[]  the controlled way of working
//   incorrectPractice[] the unsafe practice this training exists to stop
//   ppe[]              minimum PPE for the activity
//   visual             prompt/brief for the 3D training visual (see hseVisuals)

export const CATEGORIES = Object.freeze([
  { key: "construction", label: "Construction Site Safety", accent: "#f59e0b" },
  { key: "fire", label: "Fire & Emergency Safety", accent: "#ef4444" },
  { key: "road", label: "Road & Highway Safety", accent: "#38bdf8" },
  { key: "electrical", label: "Electrical Safety", accent: "#facc15" },
  { key: "industrial", label: "Manufacturing & Industrial Safety", accent: "#a78bfa" },
  { key: "chemical", label: "Chemical Safety", accent: "#34d399" },
  { key: "ppe", label: "PPE", accent: "#60a5fa" }
]);

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((category) => [category.key, category.label])
);

const concept = (id, category, title, body) => ({
  id,
  category,
  title,
  duration: 15,
  ppe: [],
  hazards: [],
  correctPractice: [],
  incorrectPractice: [],
  ...body
});

/* ------------------------------------------------ construction site safety */

const construction = [
  concept("working-at-height", "construction", "Working at Height", {
    duration: 25,
    concept: "Fall prevention and fall arrest when working above ground level",
    objective:
      "Select, inspect and correctly attach a full-body harness to an approved anchor point before any work above 1.8 m.",
    hazards: [
      "Falls from open edges, fragile surfaces and unprotected openings",
      "Dropped tools and materials striking people below",
      "Anchor point failure or incorrect lanyard length allowing a free fall",
      "Suspension trauma after an arrested fall with no rescue plan"
    ],
    correctPractice: [
      "Full-body harness inspected before use and attached to an approved anchor rated for the load",
      "Anchor positioned above the worker so free-fall distance stays within the lanyard rating",
      "Edge protection or guard rails installed, and the area below barricaded",
      "Rescue plan agreed and a trained rescuer available before work starts"
    ],
    incorrectPractice: [
      "Working at the edge with the harness worn but the lanyard clipped to nothing",
      "Anchoring to handrails, scaffold ties or pipework not rated as an anchor",
      "Leaving tools loose at the edge above an unbarricaded walkway"
    ],
    ppe: ["Safety Helmet with chinstrap", "Full-Body Safety Harness", "Safety Shoes", "Safety Gloves", "Safety Glasses"],
    visual: "workingAtHeight"
  }),
  concept("scaffolding-safety", "construction", "Scaffolding Safety", {
    duration: 20,
    concept: "Erection, inspection and safe use of access scaffolds",
    objective: "Verify a scaffold is tagged, complete and safe to use before stepping onto it.",
    hazards: [
      "Collapse from missing ties, bracing or an unstable base",
      "Falls through incomplete platforms or missing toe boards",
      "Overloading a platform beyond its rated duty"
    ],
    correctPractice: [
      "Check the scaffold tag is current and green before access",
      "Fully boarded platform with guard rails and toe boards in place",
      "Ladder or stair access used, on a firm and level sole plate",
      "Load kept within the rated duty and distributed across the platform"
    ],
    incorrectPractice: [
      "Climbing the scaffold frame instead of using the access ladder",
      "Removing guard rails or boards to pass material and not replacing them",
      "Using a scaffold with a red or missing tag"
    ],
    ppe: ["Safety Helmet", "Safety Harness", "Safety Shoes", "High-Visibility Vest"],
    visual: "constructionSite"
  }),
  concept("ladder-safety", "construction", "Ladder Safety", {
    duration: 12,
    concept: "Selection, placement and use of portable ladders",
    objective: "Set up and climb a ladder at the correct angle with three points of contact maintained.",
    hazards: ["Ladder slipping at the base or top", "Overreaching causing a sideways fall", "Damaged stiles or rungs failing"],
    correctPractice: [
      "1:4 angle, base on firm level ground, top extending 1 m above the landing",
      "Ladder footed or tied off at the top before climbing",
      "Three points of contact maintained; tools carried in a belt or hoisted separately"
    ],
    incorrectPractice: [
      "Standing on the top two rungs or on the ladder's top cap",
      "Leaning sideways past the stiles instead of moving the ladder",
      "Using a ladder with a cracked stile or a missing rung"
    ],
    ppe: ["Safety Helmet", "Safety Shoes", "Safety Gloves"],
    visual: "constructionSite"
  }),
  concept("excavation-safety", "construction", "Excavation Safety", {
    duration: 22,
    concept: "Ground stability, access and services control around excavations",
    objective: "Confirm shoring, access and services clearance before anyone enters an excavation.",
    hazards: [
      "Collapse of unsupported sides burying a worker",
      "Striking buried electrical, gas or water services",
      "Vehicles or spoil loads placed too close to the edge",
      "Accumulated water or oxygen-deficient atmosphere in deep excavations"
    ],
    correctPractice: [
      "Shoring, benching or battering installed for any excavation over 1.2 m",
      "Service drawings checked and cable-avoidance scan completed before breaking ground",
      "Ladder access within 8 m of every worker; spoil kept at least 1 m from the edge",
      "Barricading and edge protection around the full perimeter"
    ],
    incorrectPractice: [
      "Entering an unsupported trench to save time on shoring",
      "Parking plant or stacking spoil immediately at the excavation edge",
      "Jumping down into an excavation instead of using the access ladder"
    ],
    ppe: ["Safety Helmet", "Safety Shoes", "High-Visibility Vest", "Safety Gloves"],
    visual: "constructionSite"
  }),
  concept("trenching-safety", "construction", "Trenching Safety", {
    duration: 18,
    concept: "Protective systems for narrow, deep trenches",
    objective: "Identify soil type and select the matching protective system before trench entry.",
    hazards: ["Sidewall collapse in narrow trenches", "Falling material from the spoil heap", "Restricted escape in a long trench run"],
    correctPractice: [
      "Trench box or hydraulic shoring matched to the assessed soil type",
      "Daily inspection by a competent person and after any rainfall",
      "Escape ladders at intervals along the trench run"
    ],
    incorrectPractice: [
      "Reusing shoring rated for firmer ground than the actual soil",
      "Working ahead of the trench box in the unsupported section"
    ],
    ppe: ["Safety Helmet", "Safety Shoes", "High-Visibility Vest"],
    visual: "constructionSite"
  }),
  concept("lifting-operations", "construction", "Lifting Operations", {
    duration: 25,
    concept: "Planned lifting with competent slinging and exclusion zones",
    objective: "Follow an approved lift plan and keep every person clear of the load path.",
    hazards: ["Load swinging or dropping onto people", "Sling or shackle failure from overload or damage", "Contact with overhead power lines"],
    correctPractice: [
      "Written lift plan with an appointed lift supervisor and trained signaller",
      "Slings, shackles and hooks inspected and within their certification date",
      "Exclusion zone barricaded; tag lines used to control the load",
      "No lifting over occupied areas or live traffic lanes"
    ],
    incorrectPractice: [
      "Standing or walking under a suspended load",
      "Using a damaged sling because a replacement is not on site",
      "Lifting without a signaller when the operator cannot see the landing area"
    ],
    ppe: ["Safety Helmet", "Safety Shoes", "High-Visibility Vest", "Safety Gloves"],
    visual: "constructionSite"
  }),
  concept("crane-safety", "construction", "Crane Safety", {
    duration: 22,
    concept: "Crane set-up, capacity and exclusion control",
    objective: "Verify ground bearing, outrigger deployment and load chart limits before every lift.",
    hazards: ["Overturning from soft ground or retracted outriggers", "Exceeding the rated capacity at radius", "Boom contact with overhead lines"],
    correctPractice: [
      "Outriggers fully extended on rated mats, crane level within tolerance",
      "Load and radius checked against the load chart for the configuration in use",
      "Minimum approach distance to overhead lines observed or lines isolated"
    ],
    incorrectPractice: [
      "Lifting on partly extended outriggers to fit a tight space",
      "Ignoring the load-moment indicator alarm to finish a lift"
    ],
    ppe: ["Safety Helmet", "Safety Shoes", "High-Visibility Vest"],
    visual: "constructionSite"
  }),
  concept("material-handling", "construction", "Material Handling", {
    duration: 15,
    concept: "Manual and mechanical movement of materials without injury",
    objective: "Assess a load and choose a safe handling method before lifting it.",
    hazards: ["Back and shoulder injury from poor lifting technique", "Crushed hands and feet from dropped loads", "Unstable stacks toppling"],
    correctPractice: [
      "Assess weight and route first; use mechanical aids for heavy or awkward loads",
      "Lift with a straight back and bent knees, load held close to the body",
      "Stack on level ground within the safe stacking height, heaviest at the bottom"
    ],
    incorrectPractice: [
      "Twisting at the waist while carrying a load",
      "Carrying a load that blocks the view of the route ahead"
    ],
    ppe: ["Safety Gloves", "Safety Shoes", "Safety Helmet"],
    visual: "constructionSite"
  }),
  concept("ppe-fundamentals", "construction", "PPE Fundamentals", {
    duration: 12,
    concept: "Correct selection, fit, inspection and care of personal protective equipment",
    objective: "Select the right PPE for the task and confirm it fits and is serviceable.",
    hazards: ["Impact, penetration, dust, noise and chemical exposure reaching the body", "Defective or wrongly sized PPE giving false confidence"],
    correctPractice: [
      "PPE matched to the assessed risk of the specific task",
      "Inspect before every use; replace damaged or expired items immediately",
      "Helmet chinstrap fastened, glasses over the eyes, vest fully closed"
    ],
    incorrectPractice: [
      "Helmet worn backwards or without the chinstrap at height",
      "Safety glasses pushed up onto the helmet while grinding",
      "Sharing a harness or respirator that has not been fit-checked for the wearer"
    ],
    ppe: ["Safety Helmet", "Safety Glasses", "Safety Gloves", "Safety Shoes", "High-Visibility Vest"],
    visual: "ppe"
  }),
  concept("housekeeping", "construction", "Housekeeping", {
    duration: 10,
    concept: "Keeping work areas clear, clean and walkable",
    objective: "Maintain clear access routes and remove waste and trip hazards continuously.",
    hazards: ["Slips, trips and falls on the same level", "Fire load from accumulated combustible waste", "Protruding nails and reinforcement bars"],
    correctPractice: [
      "Clear as you go; waste segregated into the correct bins at the end of each task",
      "Walkways, stairs and emergency exits kept clear at all times",
      "Reinforcement bar ends capped, cables routed overhead or covered"
    ],
    incorrectPractice: [
      "Leaving off-cuts, banding and packaging on the access route",
      "Stacking material in front of a fire extinguisher or exit door"
    ],
    ppe: ["Safety Gloves", "Safety Shoes", "Safety Helmet"],
    visual: "constructionSite"
  }),
  concept("tool-safety", "construction", "Hand & Power Tool Safety", {
    duration: 15,
    concept: "Inspection, guarding and correct use of hand and power tools",
    objective: "Inspect a tool and confirm its guard and cable are intact before use.",
    hazards: ["Contact with unguarded rotating parts", "Electric shock from damaged leads", "Flying particles and abrasive wheel burst"],
    correctPractice: [
      "Guards in place; abrasive wheels within their expiry and correctly mounted",
      "Pre-use inspection of body, cable and plug; damaged tools quarantined and tagged",
      "Right tool for the job, used with both hands and a stable workpiece"
    ],
    incorrectPractice: [
      "Removing the guard from an angle grinder for better access",
      "Using a tool with taped-over cable damage"
    ],
    ppe: ["Safety Glasses", "Face Shield", "Safety Gloves", "Ear Protection"],
    visual: "manufacturing"
  }),
  concept("night-work-safety", "construction", "Night Work Safety", {
    duration: 15,
    concept: "Controls for reduced visibility and fatigue during night shifts",
    objective: "Set up lighting, conspicuity and fatigue controls before a night shift begins.",
    hazards: ["Reduced visibility of workers and hazards", "Fatigue-related errors", "Glare disorientating drivers and workers"],
    correctPractice: [
      "Task lighting to the required lux level, aimed away from oncoming traffic",
      "Class 3 retro-reflective clothing for every person on foot",
      "Planned breaks and shift-length limits; buddy checks through the shift"
    ],
    incorrectPractice: [
      "Relying on vehicle headlights as the only work lighting",
      "Working alone in an unlit section without communication"
    ],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Helmet with lamp", "Safety Shoes"],
    visual: "roadSafety"
  })
];

/* ---------------------------------------------------- fire & emergency */

const fire = [
  concept("fire-prevention", "fire", "Fire Prevention", {
    duration: 15,
    concept: "Removing ignition sources and controlling fire load",
    objective: "Identify and separate the three elements of the fire triangle in a work area.",
    hazards: ["Hot work near combustibles", "Accumulated waste and flammable liquid storage", "Overloaded temporary electrical distribution"],
    correctPractice: [
      "Hot work permit, fire watch and a 10 m combustible-free radius",
      "Flammables in a marked, ventilated store away from ignition sources",
      "Housekeeping schedule that removes combustible waste daily"
    ],
    incorrectPractice: [
      "Grinding or welding beside stacked packaging material",
      "Storing fuel cans in the same cabin as the site generator"
    ],
    ppe: ["Fire-Retardant Coveralls", "Safety Helmet", "Face Shield", "Safety Gloves"],
    visual: "fireEvacuation"
  }),
  concept("fire-extinguisher-use", "fire", "Fire Extinguisher Use", {
    duration: 18,
    concept: "Selecting and operating the correct extinguisher class",
    objective: "Match the extinguisher class to the fire type and apply the PASS technique.",
    hazards: ["Wrong extinguisher class spreading the fire (water on electrical or oil)", "Attempting a fire beyond first-aid firefighting size"],
    correctPractice: [
      "Raise the alarm first, then tackle only a small incipient fire",
      "Correct class: CO2 or dry powder for electrical, foam for flammable liquid, water for Class A",
      "PASS — Pull, Aim at the base, Squeeze, Sweep — with an escape route behind you"
    ],
    incorrectPractice: [
      "Using a water extinguisher on a live electrical panel fire",
      "Fighting a fire with the exit behind the flames"
    ],
    ppe: ["Safety Gloves", "Safety Helmet"],
    visual: "fireEvacuation"
  }),
  concept("fire-evacuation", "fire", "Fire Emergency Evacuation", {
    duration: 15,
    concept: "Orderly evacuation to the designated assembly point",
    objective: "Evacuate by the nearest safe route and report to the assembly point for roll call.",
    hazards: ["Blocked or locked exit routes", "Smoke inhalation during delayed evacuation", "Unaccounted persons triggering a re-entry search"],
    correctPractice: [
      "Leave immediately on the alarm by the nearest marked exit; do not collect belongings",
      "Keep low under smoke; use stairs, never a lift",
      "Report to the assembly point and stay until roll call is complete"
    ],
    incorrectPractice: [
      "Returning to the workplace for personal items",
      "Leaving the assembly point before the head count is confirmed"
    ],
    ppe: ["High-Visibility Vest"],
    visual: "fireEvacuation"
  }),
  concept("emergency-assembly", "fire", "Emergency Assembly Points", {
    duration: 10,
    concept: "Knowing, reaching and using the muster point",
    objective: "Locate the assembly point for your work area and follow the roll-call process.",
    hazards: ["Assembly in a location exposed to traffic or the incident itself", "Incomplete head count delaying rescue"],
    correctPractice: [
      "Know the primary and alternate assembly points for every area you work in",
      "Report to your warden by name; report anyone known to be missing"
    ],
    incorrectPractice: ["Assembling in the vehicle park directly beside the live carriageway"],
    ppe: ["High-Visibility Vest"],
    visual: "fireEvacuation"
  }),
  concept("emergency-response", "fire", "Emergency Response", {
    duration: 20,
    concept: "First minutes of any site emergency",
    objective: "Make the area safe, raise the alarm and hand over a clear situation report.",
    hazards: ["Responders becoming casualties", "Delayed or unclear escalation", "Uncontrolled secondary hazards"],
    correctPractice: [
      "Protect yourself first, then isolate the hazard if it is safe to do so",
      "Raise the alarm with location, nature, number of casualties and hazards present",
      "Control access until the response team arrives"
    ],
    incorrectPractice: ["Entering a confined space or smoke-filled room to attempt a rescue without equipment"],
    ppe: ["High-Visibility Vest", "Safety Helmet", "Safety Gloves"],
    visual: "fireEvacuation"
  }),
  concept("emergency-contact-procedure", "fire", "Emergency Contact Procedure", {
    duration: 8,
    concept: "Who to call, in what order, with what information",
    objective: "Escalate an emergency through the correct chain without delay.",
    hazards: ["Time lost locating a number", "Incomplete information sent to responders"],
    correctPractice: [
      "Emergency numbers displayed at every work front and stored in every site phone",
      "State location by chainage or plaza name, then nature and casualties"
    ],
    incorrectPractice: ["Calling a supervisor's personal phone instead of the emergency control room"],
    ppe: [],
    visual: "fireEvacuation"
  }),
  concept("first-aid", "fire", "First Aid", {
    duration: 25,
    concept: "Immediate care until professional help arrives",
    objective: "Perform a primary survey and give appropriate first aid without endangering yourself.",
    hazards: ["Cross-infection from blood and body fluids", "Worsening a spinal injury by moving a casualty", "Responder injury from an uncontrolled scene"],
    correctPractice: [
      "Check danger, response, airway, breathing and circulation in that order",
      "Control bleeding with direct pressure; keep the casualty warm and reassured",
      "Do not move a suspected spinal injury unless there is an immediate threat"
    ],
    incorrectPractice: [
      "Giving fluids to an unconscious casualty",
      "Removing an embedded object from a wound"
    ],
    ppe: ["Disposable Gloves", "Face Shield / CPR mask"],
    visual: "fireEvacuation"
  }),
  concept("incident-reporting", "fire", "Incident Reporting", {
    duration: 12,
    concept: "Reporting incidents and near misses so causes can be removed",
    objective: "Report every incident and near miss the same day, factually and without blame.",
    hazards: ["Repeat incidents from unreported near misses", "Evidence lost before investigation"],
    correctPractice: [
      "Report the same day, including near misses with no injury",
      "Preserve the scene and photograph conditions before clearing",
      "Record facts and times; leave cause determination to the investigation"
    ],
    incorrectPractice: ["Clearing and resuming work before the scene has been recorded"],
    ppe: [],
    visual: "fireEvacuation"
  }),
  concept("emergency-communication", "fire", "Emergency Communication", {
    duration: 10,
    concept: "Clear radio and verbal communication during an incident",
    objective: "Pass accurate emergency information on the correct channel using a standard format.",
    hazards: ["Channel congestion drowning out the incident", "Ambiguous location descriptions"],
    correctPractice: [
      "Use the designated emergency channel; keep it clear of routine traffic",
      "Identify yourself, give the location by chainage, then the message; confirm receipt"
    ],
    incorrectPractice: ["Continuing routine radio traffic on the emergency channel during an incident"],
    ppe: [],
    visual: "fireEvacuation"
  })
];

/* ------------------------------------------------------ road & highway */

const road = [
  concept("toll-plaza-safety", "road", "Toll Plaza Safety", {
    duration: 18,
    concept: "Working safely in and around live toll lanes",
    objective: "Move through and work in a toll plaza without entering a live lane unprotected.",
    hazards: ["Struck by a vehicle entering or leaving a lane", "Barrier arm strike", "Exhaust fumes and noise in the booth environment"],
    correctPractice: [
      "Cross only at marked crossings, behind the closed-lane barrier",
      "Close and cone the lane before any work in it; confirm closure with the control room",
      "Face oncoming traffic; never step out from behind a booth without looking"
    ],
    incorrectPractice: [
      "Walking between live lanes to reach a booth",
      "Reaching into a lane to clear debris while traffic is still flowing"
    ],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Shoes", "Safety Helmet"],
    visual: "roadSafety"
  }),
  concept("lane-safety", "road", "Lane Safety", {
    duration: 15,
    concept: "Establishing and working within a protected lane closure",
    objective: "Set up a compliant lane closure with correct taper and buffer before work begins.",
    hazards: ["Vehicles intruding into the work zone", "Inadequate taper causing late driver reaction"],
    correctPractice: [
      "Advance warning signs, taper and buffer zone set to the approved traffic management plan",
      "Work strictly within the coned area; a safety buffer kept empty of people and plant",
      "Closure removed in reverse order, from the downstream end"
    ],
    incorrectPractice: [
      "Starting work while the taper is still being laid out",
      "Storing material in the buffer zone"
    ],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Helmet", "Safety Shoes"],
    visual: "roadSafety"
  }),
  concept("traffic-management", "road", "Traffic Management", {
    duration: 20,
    concept: "Controlling traffic around a work zone",
    objective: "Implement and supervise a traffic management plan appropriate to the road speed.",
    hazards: ["Head-on conflict during diversion", "Pedestrian and worker exposure to live traffic", "Queue-end collisions"],
    correctPractice: [
      "Approved TMP in place before work; signage distances matched to the posted speed",
      "Trained flagger with correct sign and stance where manual control is used",
      "Queue monitoring and advance warning when tailbacks form"
    ],
    incorrectPractice: [
      "Positioning the flagger inside the live lane rather than at the edge",
      "Leaving signage in place after the work zone is cleared"
    ],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Helmet"],
    visual: "roadSafety"
  }),
  concept("vehicle-reversal-safety", "road", "Vehicle Reversal Safety", {
    duration: 12,
    concept: "Eliminating and controlling reversing movements",
    objective: "Plan site movements to avoid reversing, and use a banksman where it is unavoidable.",
    hazards: ["Pedestrian struck in the driver's blind zone", "Reversing into structures or open excavations"],
    correctPractice: [
      "Design one-way routes and turning circles so reversing is not needed",
      "Trained banksman in view of the mirror at all times; agreed hand signals",
      "Reversing alarm and working camera or mirrors before the vehicle moves"
    ],
    incorrectPractice: [
      "Reversing without a banksman because the area 'looked clear'",
      "Banksman standing directly behind the vehicle in the blind zone"
    ],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Helmet", "Safety Shoes"],
    visual: "roadSafety"
  }),
  concept("fastag-lane-safety", "road", "FASTag Lane Safety", {
    duration: 12,
    concept: "Maintenance and marshalling in dedicated electronic toll lanes",
    objective: "Work on FASTag lane equipment without exposure to non-stopping traffic.",
    hazards: ["Vehicles passing at speed without slowing for the barrier", "Working at the gantry within the swept path"],
    correctPractice: [
      "Close the lane fully before any gantry, reader or camera maintenance",
      "Confirm the barrier and reader are isolated before working within the lane"
    ],
    incorrectPractice: ["Adjusting a reader from a ladder in a lane that is still open to traffic"],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Helmet", "Safety Shoes"],
    visual: "roadSafety"
  }),
  concept("roadside-work-safety", "road", "Roadside Work Safety", {
    duration: 15,
    concept: "Working on the verge and shoulder adjacent to live traffic",
    objective: "Position people, plant and vehicles so no one works with their back to traffic.",
    hazards: ["Errant vehicle leaving the carriageway", "Slips on unstable verge and drainage edges"],
    correctPractice: [
      "Work vehicle parked upstream as a shield, with beacons on",
      "Always face oncoming traffic; keep a planned escape route to the verge"
    ],
    incorrectPractice: ["Parking downstream of the work so the crew is unprotected from approaching traffic"],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Shoes", "Safety Helmet"],
    visual: "roadSafety"
  }),
  concept("traffic-diversion", "road", "Traffic Diversion", {
    duration: 18,
    concept: "Safely diverting traffic onto an alternate route or carriageway",
    objective: "Execute a diversion in the planned sequence with continuous signing.",
    hazards: ["Contraflow head-on conflict", "Drivers missing a poorly signed diversion point"],
    correctPractice: [
      "Diversion signed continuously from the decision point to the rejoin",
      "Crossover installed and delineated before traffic is switched",
      "Change made in low-flow periods wherever possible"
    ],
    incorrectPractice: ["Switching traffic before the full diversion route is signed and open"],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Helmet"],
    visual: "roadSafety"
  }),
  concept("cones-and-barricades", "road", "Cones and Barricades", {
    duration: 10,
    concept: "Correct delineation of a work zone",
    objective: "Lay out and retrieve cones and barricades safely and to the required spacing.",
    hazards: ["Worker exposure while placing or collecting cones", "Displaced cones leaving a gap in the closure"],
    correctPractice: [
      "Place and collect from the shoulder side, moving with the direction of traffic",
      "Spacing and height to the traffic management plan; retro-reflective sleeves clean",
      "Check the closure regularly and replace displaced units immediately"
    ],
    incorrectPractice: ["Walking against traffic in the live lane to retrieve cones"],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Gloves", "Safety Shoes"],
    visual: "roadSafety"
  }),
  concept("night-traffic-safety", "road", "Night Traffic Safety", {
    duration: 15,
    concept: "Conspicuity and lighting for night-time roadworks",
    objective: "Make the work zone and every worker visible to approaching drivers at night.",
    hazards: ["Drivers failing to see the taper", "Glare from work lighting blinding drivers"],
    correctPractice: [
      "Illuminated advance warning and lit taper; beacons on all site vehicles",
      "Work lighting aimed into the site, shielded from the carriageway"
    ],
    incorrectPractice: ["Floodlights pointed toward oncoming traffic"],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Helmet with lamp"],
    visual: "roadSafety"
  }),
  concept("pedestrian-safety", "road", "Pedestrian Safety", {
    duration: 12,
    concept: "Segregating people from vehicles and plant",
    objective: "Maintain a protected pedestrian route through and around the work area.",
    hazards: ["Pedestrian routed into a live carriageway", "Plant crossing a walkway without control"],
    correctPractice: [
      "Continuous segregated walkway with physical barriers, kept clear and lit",
      "Controlled crossing points where plant routes intersect walkways"
    ],
    incorrectPractice: ["Closing the footway and leaving pedestrians to walk in the traffic lane"],
    ppe: ["High-Visibility Vest"],
    visual: "roadSafety"
  }),
  concept("vehicle-breakdown-safety", "road", "Vehicle Breakdown Safety", {
    duration: 12,
    concept: "Response to a broken-down vehicle in or near a live lane",
    objective: "Secure a breakdown scene without placing responders in the traffic stream.",
    hazards: ["Secondary collision with the stopped vehicle", "Occupants standing beside the carriageway"],
    correctPractice: [
      "Move the vehicle to the shoulder if possible; hazards on, warning triangle at the required distance",
      "Occupants evacuated behind the barrier, not in the vehicle or on the verge edge",
      "Recovery requested through the control room"
    ],
    incorrectPractice: ["Occupants remaining seated in a vehicle stopped in a live lane"],
    ppe: ["High-Visibility Vest (Class 3)"],
    visual: "roadSafety"
  }),
  concept("highway-maintenance-safety", "road", "Highway Maintenance Safety", {
    duration: 18,
    concept: "Routine maintenance activities on a live highway",
    objective: "Plan and execute routine maintenance with the correct closure and plant controls.",
    hazards: ["Mobile plant operating close to live traffic", "Hot bitumen burns during patching", "Manual handling of drainage covers"],
    correctPractice: [
      "Mobile works closure moving with the operation; trailing vehicle-mounted crash cushion where required",
      "Hot works PPE for bitumen; lifting aids for covers and gullies"
    ],
    incorrectPractice: ["Mobile patching without a trailing protection vehicle on a high-speed road"],
    ppe: ["High-Visibility Vest (Class 3)", "Safety Helmet", "Safety Gloves", "Safety Shoes"],
    visual: "roadSafety"
  })
];

/* ---------------------------------------------------------- electrical */

const electrical = [
  concept("electrical-hazards", "electrical", "Electrical Hazards", {
    duration: 18,
    concept: "Recognising shock, arc-flash and burn hazards",
    objective: "Identify electrical hazards in a work area and the controls that remove them.",
    hazards: ["Electric shock and electrocution", "Arc flash burns and blast", "Secondary injury from involuntary reaction at height"],
    correctPractice: [
      "Treat every conductor as live until proven dead by a competent person",
      "Work de-energised wherever reasonably practicable",
      "Maintain approach distances; only authorised persons inside the panel room"
    ],
    incorrectPractice: [
      "Testing for the presence of voltage with a screwdriver or by touch",
      "Working on a live panel because isolation would interrupt operations"
    ],
    ppe: ["Electrical Insulating Gloves", "Arc-Rated Face Shield", "Electrical Safety Shoes", "Flame-Resistant Clothing"],
    visual: "electrical"
  }),
  concept("lockout-tagout", "electrical", "Lockout / Tagout (LOTO)", {
    duration: 25,
    concept: "Positive isolation of energy before maintenance",
    objective: "Apply the full isolate-lock-tag-test sequence and verify zero energy before work.",
    hazards: ["Unexpected re-energisation during maintenance", "Stored energy in capacitors, springs and pressure systems", "Another worker removing your lock"],
    correctPractice: [
      "Identify every energy source, isolate, lock, tag, then test for dead",
      "Personal lock per worker on a multi-hasp; only the owner removes their own lock",
      "Discharge stored energy and prove zero energy at the point of work"
    ],
    incorrectPractice: [
      "Tag applied without a physical lock",
      "Cutting off a colleague's lock to finish a job at shift end"
    ],
    ppe: ["Electrical Insulating Gloves", "Safety Glasses", "Electrical Safety Shoes"],
    visual: "electrical"
  }),
  concept("electrical-ppe", "electrical", "Electrical PPE", {
    duration: 15,
    concept: "Arc-rated and insulating protective equipment",
    objective: "Select PPE rated for the arc-flash energy and voltage at the point of work.",
    hazards: ["Inadequate arc rating for the incident energy", "Insulating gloves failing from unnoticed damage"],
    correctPractice: [
      "PPE category selected from the arc-flash label on the equipment",
      "Insulating gloves air-tested before every use and within their retest date",
      "No conductive jewellery or watches"
    ],
    incorrectPractice: ["Cotton coveralls used in place of arc-rated clothing at a switchboard"],
    ppe: ["Arc-Rated Suit", "Electrical Insulating Gloves", "Arc-Rated Face Shield", "Electrical Safety Shoes"],
    visual: "electrical"
  }),
  concept("panel-safety", "electrical", "Panel Safety", {
    duration: 15,
    concept: "Safe access to distribution and control panels",
    objective: "Work at a panel with the correct isolation, clearance and access control.",
    hazards: ["Arc flash on opening a loaded panel", "Contact with exposed busbars", "Obstructed panel access during an emergency"],
    correctPractice: [
      "Panel isolated and proven dead before the door is opened for work",
      "1 m clear working space maintained in front of every panel",
      "Doors closed and latched, covers refitted before energising"
    ],
    incorrectPractice: [
      "Storing material against the panel door",
      "Leaving a panel open and unattended in a public area"
    ],
    ppe: ["Arc-Rated Face Shield", "Electrical Insulating Gloves", "Flame-Resistant Clothing"],
    visual: "electrical"
  }),
  concept("cable-safety", "electrical", "Cable Safety", {
    duration: 12,
    concept: "Routing, protecting and inspecting temporary cables",
    objective: "Route and protect cables so they cannot be damaged or create a trip hazard.",
    hazards: ["Damaged insulation exposing conductors", "Trip hazard from trailing leads", "Vehicle crushing of surface-laid cable"],
    correctPractice: [
      "Route overhead or in protective ramps; never across a traffic route unprotected",
      "Pre-use inspection of the full length; damaged cable removed from service and tagged"
    ],
    incorrectPractice: ["Repairing a damaged cable with insulating tape and returning it to service"],
    ppe: ["Safety Gloves", "Safety Shoes"],
    visual: "electrical"
  }),
  concept("generator-safety", "electrical", "Generator Safety", {
    duration: 15,
    concept: "Safe siting, earthing and refuelling of generators",
    objective: "Site, earth and refuel a generator without exhaust, fire or shock risk.",
    hazards: ["Carbon monoxide accumulation in enclosed areas", "Fire during refuelling on a hot machine", "Shock from an unearthed set"],
    correctPractice: [
      "Site in the open air, exhaust directed away from occupied areas",
      "Shut down and allow to cool before refuelling; extinguisher at hand",
      "Earth electrode installed and continuity verified before energising"
    ],
    incorrectPractice: [
      "Running a generator inside a cabin or partly enclosed booth",
      "Refuelling while the set is running"
    ],
    ppe: ["Safety Gloves", "Safety Glasses", "Ear Protection", "Safety Shoes"],
    visual: "electrical"
  }),
  concept("earthing", "electrical", "Earthing and Bonding", {
    duration: 15,
    concept: "Providing a safe path to earth for fault current",
    objective: "Verify earthing and bonding are continuous and within resistance limits.",
    hazards: ["Exposed metalwork becoming live under fault", "High earth resistance preventing protective device operation"],
    correctPractice: [
      "Earth continuity and resistance tested and recorded before energisation",
      "All exposed conductive parts bonded; earth connections kept clean and tight"
    ],
    incorrectPractice: ["Disconnecting an earth conductor to silence a nuisance trip"],
    ppe: ["Electrical Insulating Gloves", "Safety Glasses"],
    visual: "electrical"
  }),
  concept("electrical-fire", "electrical", "Electrical Fire Response", {
    duration: 12,
    concept: "Responding to fire in live electrical equipment",
    objective: "Isolate supply and apply the correct extinguishing agent to an electrical fire.",
    hazards: ["Conductive extinguishing agent causing electrocution", "Re-ignition from a still-energised circuit"],
    correctPractice: [
      "Isolate the supply first if it can be done safely; then raise the alarm",
      "CO2 or dry powder only; keep clear of the discharge horn"
    ],
    incorrectPractice: ["Using water or foam on energised electrical equipment"],
    ppe: ["Safety Gloves", "Face Shield"],
    visual: "electrical"
  }),
  concept("electrical-isolation", "electrical", "Electrical Isolation", {
    duration: 18,
    concept: "Formal isolation, permit and hand-back",
    objective: "Follow the permit-controlled isolation and hand-back procedure end to end.",
    hazards: ["Isolating the wrong circuit", "Re-energising while people are still at work"],
    correctPractice: [
      "Positive identification of the circuit against drawings and labels before isolation",
      "Permit issued, locks applied, proven dead with a tested-good voltage indicator",
      "Formal hand-back: all persons clear, covers refitted, permit cancelled, then energise"
    ],
    incorrectPractice: ["Energising on a verbal 'all clear' without cancelling the permit"],
    ppe: ["Electrical Insulating Gloves", "Arc-Rated Face Shield", "Flame-Resistant Clothing"],
    visual: "electrical"
  })
];

/* ------------------------------------------- manufacturing / industrial */

const industrial = [
  concept("machine-guarding", "industrial", "Machine Guarding", {
    duration: 18,
    concept: "Fixed and interlocked guards on moving machinery",
    objective: "Confirm guards are fitted and interlocks functional before operating a machine.",
    hazards: ["Entanglement in rotating shafts and drives", "Crushing at in-running nips", "Ejected material from an unguarded process"],
    correctPractice: [
      "Guards fitted and secured; interlocks function-tested and never bypassed",
      "Machine stopped and isolated before any guard is removed for maintenance"
    ],
    incorrectPractice: [
      "Taping or wedging an interlock to keep a machine running with the guard open",
      "Clearing a jam through an opened guard while the drive is still powered"
    ],
    ppe: ["Safety Glasses", "Safety Shoes", "Close-fitting clothing (no loose sleeves)"],
    visual: "manufacturing"
  }),
  concept("danger-zones", "industrial", "Danger Zones", {
    duration: 12,
    concept: "Marked exclusion areas around operating equipment",
    objective: "Recognise and stay clear of marked danger zones during machine operation.",
    hazards: ["Entering a robot or press envelope during a cycle", "Being struck by a moving load or arm"],
    correctPractice: [
      "Floor marking and physical barriers define the envelope; entry only with the machine stopped",
      "Light curtains and mats tested regularly and never obstructed"
    ],
    incorrectPractice: ["Stepping over a light curtain to reach a part inside the cell"],
    ppe: ["Safety Helmet", "Safety Shoes", "High-Visibility Vest"],
    visual: "manufacturing"
  }),
  concept("emergency-stop", "industrial", "Emergency Stop", {
    duration: 10,
    concept: "Location, use and reset of emergency stops",
    objective: "Locate the nearest emergency stop for any machine before you start work on it.",
    hazards: ["Delay reaching an obstructed emergency stop", "Unexpected restart after an uncontrolled reset"],
    correctPractice: [
      "Identify the nearest e-stop before starting; keep the approach clear",
      "Reset only after the cause is removed and the area is confirmed clear"
    ],
    incorrectPractice: ["Resetting an e-stop without checking why it was pressed"],
    ppe: [],
    visual: "manufacturing"
  }),
  concept("conveyor-safety", "industrial", "Conveyor Safety", {
    duration: 15,
    concept: "Working safely around belt and roller conveyors",
    objective: "Isolate a conveyor before any cleaning, clearing or maintenance.",
    hazards: ["Entanglement at drive drums and in-running nips", "Falling material from an overhead run", "Crossing a moving conveyor"],
    correctPractice: [
      "Nip guards fitted; pull-cord trip wires functional along the full run",
      "Isolate and lock off before clearing a blockage",
      "Cross only at a designated bridge or gate"
    ],
    incorrectPractice: ["Clearing spillage from under a running belt with a shovel"],
    ppe: ["Safety Glasses", "Safety Gloves", "Safety Shoes"],
    visual: "manufacturing"
  }),
  concept("forklift-safety", "industrial", "Forklift Safety", {
    duration: 20,
    concept: "Safe operation and pedestrian interaction with forklifts",
    objective: "Operate or work near a forklift within its stability and visibility limits.",
    hazards: ["Pedestrian struck or crushed", "Tip-over from overload or a raised load while travelling", "Load falling from the forks"],
    correctPractice: [
      "Licensed operators only; pre-use inspection recorded each shift",
      "Travel with the load low and tilted back; sound the horn at blind corners",
      "Segregated pedestrian routes; make eye contact before crossing an aisle"
    ],
    incorrectPractice: [
      "Travelling with the load raised for visibility over an obstacle",
      "Carrying a passenger on the forks or the counterweight"
    ],
    ppe: ["High-Visibility Vest", "Safety Shoes", "Safety Helmet"],
    visual: "manufacturing"
  }),
  concept("industrial-ppe", "industrial", "Industrial PPE", {
    duration: 12,
    concept: "PPE selection for a manufacturing environment",
    objective: "Select PPE for mechanical, noise and thermal hazards in a plant area.",
    hazards: ["Impact and abrasion injuries", "Noise-induced hearing loss", "Burns from hot surfaces and processes"],
    correctPractice: [
      "Impact-rated glasses, cut-rated gloves and toe-capped shoes as the plant baseline",
      "Hearing protection in every marked noise zone, regardless of exposure duration"
    ],
    incorrectPractice: ["Removing hearing protection to hold a short conversation inside a noise zone"],
    ppe: ["Safety Glasses", "Ear Protection", "Cut-Resistant Gloves", "Safety Shoes"],
    visual: "ppe"
  }),
  concept("mechanical-hazards", "industrial", "Mechanical Hazards", {
    duration: 15,
    concept: "Recognising crushing, shearing, cutting and entanglement hazards",
    objective: "Identify the mechanical hazard type present and the guarding that controls it.",
    hazards: ["Crushing between moving and fixed parts", "Shearing and cutting at blades and dies", "Stored energy release from springs and accumulators"],
    correctPractice: [
      "Identify hazard type before intervening; isolate and dissipate stored energy",
      "Use tools, never hands, to feed or clear a machine"
    ],
    incorrectPractice: ["Feeding a small workpiece by hand rather than with a push stick"],
    ppe: ["Cut-Resistant Gloves", "Safety Glasses", "Safety Shoes"],
    visual: "manufacturing"
  }),
  concept("noise-exposure", "industrial", "Noise Exposure", {
    duration: 12,
    concept: "Controlling exposure to harmful noise levels",
    objective: "Recognise a noise zone and use hearing protection with adequate attenuation.",
    hazards: ["Permanent noise-induced hearing loss", "Masking of alarms and reversing warnings"],
    correctPractice: [
      "Engineering controls first — enclosure, damping, distance",
      "Hearing protection selected for the measured level; worn for the full exposure period"
    ],
    incorrectPractice: ["Using cotton wool or earphones instead of rated hearing protection"],
    ppe: ["Ear Protection (plugs or muffs)"],
    visual: "manufacturing"
  }),
  concept("ergonomics", "industrial", "Ergonomics", {
    duration: 15,
    concept: "Workstation and task design that prevents strain injury",
    objective: "Adjust a workstation and task rotation to reduce repetitive-strain risk.",
    hazards: ["Musculoskeletal disorders from repetition and awkward posture", "Static loading from prolonged standing or reaching"],
    correctPractice: [
      "Work at elbow height; keep frequently used items within easy reach",
      "Rotate tasks and take micro-breaks in repetitive operations"
    ],
    incorrectPractice: ["Working with arms above shoulder height for extended periods"],
    ppe: ["Anti-Fatigue Matting (workstation control)"],
    visual: "manufacturing"
  })
];

/* -------------------------------------------------------------- chemical */

const chemical = [
  concept("chemical-handling", "chemical", "Chemical Handling", {
    duration: 20,
    concept: "Safe transfer, decanting and use of hazardous substances",
    objective: "Read the SDS and apply the specified controls before handling any chemical.",
    hazards: ["Skin and eye contact causing burns or sensitisation", "Inhalation of vapour and mist", "Incompatible chemicals reacting on mixing"],
    correctPractice: [
      "Read the SDS first; use the PPE and ventilation it specifies",
      "Decant using a pump or funnel over a bund; never by mouth siphon",
      "Label every decanted container immediately with contents and hazard"
    ],
    incorrectPractice: [
      "Decanting into an unlabelled drinks bottle",
      "Mixing cleaning chemicals to 'make them stronger'"
    ],
    ppe: ["Chemical-Resistant Gloves", "Safety Goggles", "Face Shield", "Chemical Apron", "Respirator"],
    visual: "chemicalSpill"
  }),
  concept("chemical-storage", "chemical", "Chemical Storage", {
    duration: 15,
    concept: "Segregation, bunding and ventilation of chemical stores",
    objective: "Store chemicals segregated by hazard class with adequate bunding and ventilation.",
    hazards: ["Incompatible substances stored together", "Uncontained leak reaching drainage", "Vapour accumulation in an unventilated store"],
    correctPractice: [
      "Segregate by hazard class; oxidisers away from flammables, acids from alkalis",
      "Bund capacity at least 110% of the largest container",
      "Ventilated, locked store with the chemical register and SDS file at the entrance"
    ],
    incorrectPractice: ["Storing acids and flammable solvents on the same shelf"],
    ppe: ["Chemical-Resistant Gloves", "Safety Goggles", "Safety Shoes"],
    visual: "chemicalSpill"
  }),
  concept("sds-awareness", "chemical", "SDS Awareness", {
    duration: 15,
    concept: "Reading and applying a Safety Data Sheet",
    objective: "Locate and interpret the hazard, handling, PPE and first-aid sections of an SDS.",
    hazards: ["Using a chemical without knowing its hazards", "Wrong first-aid response after exposure"],
    correctPractice: [
      "SDS available at the point of use, not only in the office",
      "Know sections 2 (hazards), 4 (first aid), 7 (handling), 8 (PPE) before first use"
    ],
    incorrectPractice: ["Relying on the container label alone for a substance new to you"],
    ppe: [],
    visual: "chemicalSpill"
  }),
  concept("chemical-spill-response", "chemical", "Chemical Spill Response", {
    duration: 22,
    concept: "Containing and cleaning a chemical release",
    objective: "Contain, absorb and dispose of a small spill using the correct spill kit.",
    hazards: ["Exposure during clean-up", "Spread to drainage and watercourse", "Reaction between the spill and the wrong absorbent"],
    correctPractice: [
      "Evacuate and isolate the area; identify the substance from the SDS before approaching",
      "Full chemical PPE; contain with booms, absorb from the outside inward",
      "Bag and label the used absorbent as hazardous waste; report the incident"
    ],
    incorrectPractice: [
      "Hosing a spill into the site drainage",
      "Approaching an unidentified spill without respiratory protection"
    ],
    ppe: ["Chemical Suit", "Chemical-Resistant Gloves", "Safety Goggles", "Respirator", "Chemical Boots"],
    visual: "chemicalSpill"
  }),
  concept("respiratory-protection", "chemical", "Respiratory Protection", {
    duration: 18,
    concept: "Selecting, fit-testing and maintaining respirators",
    objective: "Select the correct filter class and confirm face-seal fit before entering a hazardous atmosphere.",
    hazards: ["Wrong filter class for the contaminant", "Face-seal leakage from facial hair or poor fit", "Oxygen-deficient atmosphere requiring air supply, not filtration"],
    correctPractice: [
      "Filter selected for the specific contaminant; replaced on schedule or on breakthrough",
      "Fit test on record; user seal check before every entry; clean-shaven seal area",
      "Supplied-air equipment where oxygen may be deficient — filters do not make oxygen"
    ],
    incorrectPractice: ["Using a dust mask against solvent vapour"],
    ppe: ["Half or Full-Face Respirator", "Correct filter cartridges", "Safety Goggles"],
    visual: "chemicalSpill"
  }),
  concept("hazardous-substance-labelling", "chemical", "Hazardous Substance Labelling", {
    duration: 12,
    concept: "GHS pictograms, signal words and hazard statements",
    objective: "Interpret a GHS label and act on its pictograms before handling the substance.",
    hazards: ["Misidentifying a substance from an incomplete label", "Decanted containers left unlabelled"],
    correctPractice: [
      "Every container labelled with product name, GHS pictograms and signal word",
      "Damaged or illegible labels replaced before the container is used"
    ],
    incorrectPractice: ["Leaving a decanted container unlabelled 'because it will be used today'"],
    ppe: [],
    visual: "chemicalSpill"
  }),
  concept("spill-kit-usage", "chemical", "Spill Kit Usage", {
    duration: 15,
    concept: "Contents, siting and use of spill kits",
    objective: "Locate the nearest spill kit and use each component correctly.",
    hazards: ["Kit missing components when needed", "Wrong absorbent type for the spilled substance"],
    correctPractice: [
      "Kits sited at every storage and transfer point, inspected and restocked after each use",
      "Match the kit type to the substance — general, oil-only or chemical"
    ],
    incorrectPractice: ["Using an oil-only absorbent on an acid spill"],
    ppe: ["Chemical-Resistant Gloves", "Safety Goggles", "Chemical Apron"],
    visual: "chemicalSpill"
  })
];

/* ------------------------------------------------------------------ PPE */

const ppeConcepts = [
  ["helmet", "Safety Helmet", "Head protection against impact and falling objects", ["Impact from falling tools and material", "Contact with fixed low structures"], ["Chinstrap fastened when working at height or in wind", "Shell inspected for cracks; harness replaced per manufacturer interval", "Replaced after any significant impact, even without visible damage"], ["Wearing the helmet backwards", "Continuing to use a helmet that has taken an impact"]],
  ["safety-shoes", "Safety Shoes", "Foot protection against crushing, penetration and slips", ["Crushing from dropped loads", "Puncture from nails and reinforcement", "Slips on wet or oily surfaces"], ["Toe cap and midsole rating matched to the site hazard", "Laced fully and fastened; soles checked for wear and embedded objects"], ["Working in trainers or open footwear on an active site"]],
  ["safety-gloves", "Safety Gloves", "Hand protection matched to the hazard", ["Cuts and abrasion", "Chemical absorption through the skin", "Burns from hot or cold surfaces"], ["Cut-rated, chemical-rated or thermal gloves selected for the specific task", "Inspected for tears before use; chemical gloves checked for pinholes"], ["Wearing gloves near rotating machinery where entanglement is the greater risk", "Using general work gloves for chemical decanting"]],
  ["safety-glasses", "Safety Glasses", "Eye protection against impact and flying particles", ["Flying particles from grinding and cutting", "Dust and debris in windy conditions"], ["Impact-rated to the applicable standard, with side protection", "Worn over the eyes for the whole task, not pushed onto the helmet"], ["Removing glasses 'just for a moment' to see a cut line more clearly"]],
  ["face-shield", "Face Shield", "Full-face protection for high-energy and splash hazards", ["Grinding and cutting sparks", "Chemical splash to the face", "Arc flash radiant energy"], ["Worn over safety glasses, never instead of them", "Visor kept clean and free of cracks; correct shade for the process"], ["Using a face shield alone during grinding without glasses beneath"]],
  ["ear-protection", "Ear Protection", "Preventing noise-induced hearing loss", ["Permanent hearing damage above 85 dB(A)", "Alarm and warning signals being masked"], ["Attenuation rating matched to the measured noise level", "Plugs inserted correctly; muffs sealed against the head over no obstructions"], ["Wearing muffs over a helmet strap that breaks the seal"]],
  ["respirator", "Respirator", "Protecting the airway from dust, vapour and fume", ["Inhalation of silica dust, welding fume and solvent vapour", "Oxygen-deficient atmospheres"], ["Correct filter class; fit test on record; seal check before every use", "Supplied air where oxygen may be deficient"], ["Wearing a filtering respirator in a suspected oxygen-deficient space"]],
  ["safety-harness", "Safety Harness", "Fall arrest for work above ground level", ["Falls from height", "Suspension trauma after an arrested fall"], ["Full-body harness inspected before each use, attached to a rated anchor above the worker", "Rescue plan in place before work starts; harness withdrawn after arresting a fall"], ["Clipping the lanyard to itself, a handrail, or leaving it unclipped at the edge"]],
  ["high-visibility-vest", "High-Visibility Vest", "Being seen by drivers and plant operators", ["Being struck by vehicles or mobile plant", "Reduced conspicuity at night and in poor weather"], ["Class 3 garment for high-speed roadside work; kept clean so retro-reflective bands work", "Fully fastened, not worn open or tucked into a belt"], ["Wearing a faded or mud-covered vest on a live carriageway"]]
].map(([id, title, conceptText, hazards, correct, incorrect]) =>
  concept(id, "ppe", title, {
    duration: 8,
    concept: conceptText,
    objective: `Select, inspect, fit and maintain ${title.toLowerCase()} correctly for the task.`,
    hazards,
    correctPractice: correct,
    incorrectPractice: incorrect,
    ppe: [title],
    visual: "ppe"
  })
);

export const HSE_TRAINING_CATALOG = Object.freeze([
  ...construction,
  ...fire,
  ...road,
  ...electrical,
  ...industrial,
  ...chemical,
  ...ppeConcepts
]);

export const getCatalogConcept = (id) => HSE_TRAINING_CATALOG.find((item) => item.id === id) || null;

export const getCatalogByCategory = (categoryKey) =>
  categoryKey === "all"
    ? HSE_TRAINING_CATALOG
    : HSE_TRAINING_CATALOG.filter((item) => item.category === categoryKey);

export const searchCatalog = (query = "") => {
  const needle = query.trim().toLowerCase();
  if (!needle) return HSE_TRAINING_CATALOG;
  return HSE_TRAINING_CATALOG.filter((item) =>
    `${item.title} ${item.concept} ${item.objective} ${CATEGORY_LABELS[item.category]}`
      .toLowerCase()
      .includes(needle)
  );
};
