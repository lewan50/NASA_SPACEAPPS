"""
CLPS Mission Database & Catalog
Standardized planetary coordinates (IAU Moon 2000 frame):
- Latitude: -90.0 to 90.0 (°N positive, °S negative)
- Longitude: 0.0 to 360.0 (°E positive) or -180.0 to 180.0
- Elevation: km relative to Mean Lunar Radius (1,737.4 km)
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class LunarCoordinate(BaseModel):
    latitude: float = Field(..., description="Latitude in degrees [-90 to +90], North positive")
    longitude: float = Field(..., description="Longitude in degrees [0 to 360] or [-180 to 180], East positive")
    elevation_km: float = Field(0.0, description="Elevation in km relative to 1737.4 km reference sphere")
    is_confirmed: bool = Field(False, description="False indicates Target Candidate Region")
    designation: str = Field("Target Candidate Region", description="Confirmed Landing Site or Target Candidate Region")

class CLPSPayload(BaseModel):
    payload_id: str
    name: str
    acronym: Optional[str] = None
    agency_or_institution: str
    mass_kg: Optional[float] = None
    objective: str
    instrument_type: str

class CLPSMission(BaseModel):
    mission_id: str
    task_order: str
    vendor: str
    lander_name: str
    target_region: str
    coordinates: LunarCoordinate
    launch_date: Optional[str] = None
    landing_date: Optional[str] = None
    status: str  # "Landed", "Upcoming", "Anomaly", "Cancelled"
    lander_specs: Dict[str, Any]
    payload_array: List[CLPSPayload]
    summary: str


CLPS_CATALOG: List[CLPSMission] = [
    CLPSMission(
        mission_id="TO-2-IM-1",
        task_order="Task Order 2-IM (TO-2)",
        vendor="Intuitive Machines",
        lander_name="Nova-C ('Odysseus')",
        target_region="Malapert A (Lunar South Pole)",
        coordinates=LunarCoordinate(
            latitude=-80.13,
            longitude=1.44,
            elevation_km=-3.2,
            is_confirmed=True,
            designation="Confirmed Landing Site"
        ),
        launch_date="2024-02-15T06:05:00Z",
        landing_date="2024-02-22T23:23:00Z",
        status="Landed",
        lander_specs={
            "propellant": "Liquid Methane / Liquid Oxygen (Cryogenic)",
            "payload_capacity_kg": 130.0,
            "height_m": 4.0,
            "diameter_m": 1.57,
            "power_generation_w": 200.0,
            "primary_comms": "S-band and X-band Direct-To-Earth (DTE)"
        },
        payload_array=[
            CLPSPayload(
                payload_id="ROLSES",
                name="Radio Observations of the Lunar Surface Quasi-Thermal Noise and Sparks",
                acronym="ROLSES",
                agency_or_institution="NASA Goddard Space Flight Center",
                mass_kg=13.1,
                objective="Measure the lunar surface photoelectron sheath and low-frequency galactic radio emissions.",
                instrument_type="Radio Spectrometer"
            ),
            CLPSPayload(
                payload_id="LRA-IM1",
                name="Laser Retro-reflector Array",
                acronym="LRA",
                agency_or_institution="NASA Goddard Space Flight Center",
                mass_kg=0.02,
                objective="Passive optical marker for laser ranging from orbiting lunar orbiters (e.g. LRO).",
                instrument_type="Retroreflector"
            ),
            CLPSPayload(
                payload_id="NDL",
                name="Navigation Doppler Lidar for Precise Velocity and Range Sensing",
                acronym="NDL",
                agency_or_institution="NASA Langley Research Center",
                mass_kg=15.0,
                objective="Ultra-precise descent velocity and terrain clearance measurement via FMCW laser.",
                instrument_type="Optical Sensor / Lidar"
            ),
            CLPSPayload(
                payload_id="SCALPACS",
                name="Stereo Cameras for Lunar Plume-Surface Studies",
                acronym="SCALPACS",
                agency_or_institution="NASA Langley Research Center",
                mass_kg=3.5,
                objective="Photogrammetric imaging of regolith erosion and plume dynamics during engine descent.",
                instrument_type="Multispectral Camera Suite"
            ),
            CLPSPayload(
                payload_id="LN-1",
                name="Lunar Node 1 Navigation Demonstrator",
                acronym="LN-1",
                agency_or_institution="NASA Marshall Space Flight Center",
                mass_kg=2.5,
                objective="Autonomous positioning beacon operating on S-band to validate lunar PNT infrastructure.",
                instrument_type="RF Navigation Beacon"
            ),
            CLPSPayload(
                payload_id="ILO-X",
                name="International Lunar Observatory Precursor",
                acronym="ILO-X",
                agency_or_institution="ILO Association / Canadensys",
                mass_kg=0.6,
                objective="Conduct optical astronomical observations of the Milky Way galaxy center from lunar surface.",
                instrument_type="Miniature Optical Telescope"
            )
        ],
        summary="Historic commercial mission that achieved the first American soft landing on the Moon since Apollo 17 in 1972, landing within 1.5 km of target crater Malapert A."
    ),

    CLPSMission(
        mission_id="PRIME-1-IM-2",
        task_order="Task Order PRIME-1 (Polar Resources Ice Mining Experiment)",
        vendor="Intuitive Machines",
        lander_name="Nova-C ('Athena')",
        target_region="Mons Mouton (Lunar South Pole)",
        coordinates=LunarCoordinate(
            latitude=-84.79,
            longitude=29.20,
            elevation_km=1.20,
            is_confirmed=True,
            designation="Confirmed Landing Site"
        ),
        launch_date="2025-02-27T00:16:00Z",
        landing_date="2025-03-06T17:31:00Z",
        status="Landed",
        lander_specs={
            "propellant": "Liquid Methane / LOX",
            "payload_capacity_kg": 130.0,
            "height_m": 4.0,
            "diameter_m": 1.57,
            "power_generation_w": 250.0,
            "primary_comms": "Nokia 4G/LTE Lunar Local Area Network + S/X-Band DTE"
        },
        payload_array=[
            CLPSPayload(
                payload_id="TRIDENT",
                name="The Regolith and Ice Drill for Exploring New Terrains",
                acronym="TRIDENT",
                agency_or_institution="Honeybee Robotics / NASA Kennedy",
                mass_kg=25.0,
                objective="Rotary percussive 1-meter subsurface drill capable of acquiring regolith and cryo-volatiles.",
                instrument_type="Subsurface Cryogenic Drill"
            ),
            CLPSPayload(
                payload_id="MSolo",
                name="Mass Spectrometer observing lunar operations",
                acronym="MSolo",
                agency_or_institution="NASA Kennedy Space Center",
                mass_kg=8.0,
                objective="Quadrupole mass spectrometer analyzing sublimated volatiles, hydrogen, and trace ice gases.",
                instrument_type="Mass Spectrometer"
            ),
            CLPSPayload(
                payload_id="NOKIA-LTE",
                name="Lunar Surface 4G/LTE Communication Network",
                acronym="LTE-PNT",
                agency_or_institution="Nokia Bell Labs",
                mass_kg=12.0,
                objective="Demonstrate high-throughput cellular comms link between lander, rover, and base station.",
                instrument_type="Wireless Telecom Suite"
            ),
            CLPSPayload(
                payload_id="MAPP-ROVER",
                name="Micro-Advanced Projects Payload Rover",
                acronym="MAPP",
                agency_or_institution="Lunar Outpost",
                mass_kg=10.0,
                objective="Autonomous polar rover deploying Nokia user equipment and collecting 3D stereo imagery.",
                instrument_type="Autonomous Surface Mobility"
            )
        ],
        summary="Landed atop Mons Mouton near the lunar south pole on March 6, 2025 carrying NASA's PRIME-1 ice-drilling demonstration (TRIDENT + MSolo), Nokia's 4G/LTE network, and Lunar Outpost's MAPP rover. The lander tipped over after touchdown and operated for roughly 13 hours before its batteries were depleted."
    ),

    CLPSMission(
        mission_id="TO-20A-FIREFLY-BG1",
        task_order="Task Order 20A (TO-20A)",
        vendor="Firefly Aerospace",
        lander_name="Blue Ghost Mission 1",
        target_region="Mons Latreille, Mare Crisium",
        coordinates=LunarCoordinate(
            latitude=18.56,
            longitude=61.81,
            elevation_km=-3.60,
            is_confirmed=True,
            designation="Confirmed Landing Site"
        ),
        launch_date="2025-01-15T06:11:00Z",
        landing_date="2025-03-02T08:34:00Z",
        status="Landed",
        lander_specs={
            "propellant": "Hypergolic MON-25 / MMH Bi-propellant",
            "payload_capacity_kg": 155.0,
            "height_m": 2.0,
            "diameter_m": 3.5,
            "power_generation_w": 400.0,
            "primary_comms": "Deep Space Network (DSN) compatible X-band"
        },
        payload_array=[
            CLPSPayload(
                payload_id="LISTER",
                name="Lunar Instrumentation for Subsurface Thermal Exploration with Rapidity",
                acronym="LISTER",
                agency_or_institution="Texas Tech University / NASA",
                mass_kg=12.5,
                objective="Pneumatic drill penetrating 2 to 3 meters to measure lunar internal heat flow heat gradient.",
                instrument_type="Thermal Probe / Drill"
            ),
            CLPSPayload(
                payload_id="LuGRE",
                name="Lunar GNSS Receiver Experiment",
                acronym="LuGRE",
                agency_or_institution="ASI (Italian Space Agency) / NASA GSFC",
                mass_kg=8.5,
                objective="Receive GPS and Galileo satellite signals at lunar distance to validate lunar PNT fixes.",
                instrument_type="GNSS Receiver"
            ),
            CLPSPayload(
                payload_id="LEXI",
                name="Lunar Environment heliospheric X-ray Imager",
                acronym="LEXI",
                agency_or_institution="Boston University",
                mass_kg=9.2,
                objective="Capture soft X-ray images of Earth's dayside magnetosphere boundary with the solar wind.",
                instrument_type="Wide-Field X-ray Telescope"
            ),
            CLPSPayload(
                payload_id="RAC",
                name="Regolith Adherence Characterization",
                acronym="RAC",
                agency_or_institution="NASA Glenn Research Center",
                mass_kg=1.8,
                objective="Determine how lunar dust binds to diverse thermal control coatings and solar array glass.",
                instrument_type="Materials Science Sensor"
            ),
            CLPSPayload(
                payload_id="NGLR",
                name="Next Generation Lunar Retroreflectors",
                acronym="NGLR",
                agency_or_institution="University of Maryland",
                mass_kg=3.1,
                objective="Large 100mm single-corner-cube retroreflector for sub-millimeter Earth laser ranging.",
                instrument_type="Laser Retroreflector"
            )
        ],
        summary="Firefly's Blue Ghost Mission 1 touched down successfully near Mons Latreille in Mare Crisium on March 2, 2025, delivering 10 NASA science and technology payloads. It operated through a full lunar day (about 14 Earth days), capturing a total lunar eclipse and high-definition imagery of the lunar sunset before its systems shut down at nightfall."
    ),

    CLPSMission(
        mission_id="TO-20B-ASTROBOTIC-GRIFFIN",
        task_order="Task Order 20B (TO-20B)",
        vendor="Astrobotic",
        lander_name="Griffin Mission 1",
        target_region="Lunar South Pole (Site TBD)",
        coordinates=LunarCoordinate(
            latitude=-85.20,
            longitude=36.10,
            elevation_km=-0.80,
            is_confirmed=False,
            designation="Target Candidate Region"
        ),
        launch_date=None,
        landing_date=None,
        status="Upcoming",
        lander_specs={
            "propellant": "Hypergolic hydrazine/MON-3 Bi-propellant",
            "payload_capacity_kg": 500.0,
            "height_m": 3.0,
            "diameter_m": 4.5,
            "power_generation_w": 800.0,
            "primary_comms": "High-gain steerable X-band antenna"
        },
        payload_array=[
            CLPSPayload(
                payload_id="LRA-GRIFFIN",
                name="Laser Retroreflector Array",
                acronym="LRA",
                agency_or_institution="NASA GSFC",
                mass_kg=0.02,
                objective="Passive optical positioning fiducial.",
                instrument_type="Retroreflector"
            )
        ],
        summary="Astrobotic's heavy-class Griffin lander, targeting a lunar south pole landing NET late 2026. The mission was re-scoped to a commercial payload manifest after NASA cancelled the VIPER rover in July 2024; the landing site and final payload list are to be announced."
    ),

    CLPSMission(
        mission_id="TO-CP12-DRAPER-APEX",
        task_order="Task Order CP-12",
        vendor="Draper",
        lander_name="SERIES-2 ('Apex 1.0')",
        target_region="Schrödinger Basin (Far Side)",
        coordinates=LunarCoordinate(
            latitude=-75.00,
            longitude=132.50,
            elevation_km=-2.10,
            is_confirmed=False,
            designation="Target Candidate Region"
        ),
        launch_date=None,
        landing_date=None,
        status="Cancelled",
        lander_specs={
            "propellant": "Bi-propellant Hydrazine",
            "payload_capacity_kg": 300.0,
            "height_m": 2.8,
            "diameter_m": 3.8,
            "power_generation_w": 650.0,
            "primary_comms": "Lunar Relay Satellite Comm Link (Far Side Direct Earth Blockout)"
        },
        payload_array=[
            CLPSPayload(
                payload_id="FSS",
                name="Farside Seismic Suite",
                acronym="FSS",
                agency_or_institution="NASA JPL / CNES",
                mass_kg=42.0,
                objective="First seismological recordings of the lunar farside to determine crustal thickness and deep mantle convection.",
                instrument_type="Broadband & SP Seismometer"
            ),
            CLPSPayload(
                payload_id="LITMS",
                name="Lunar Interior Temperature and Materials Suite",
                acronym="LITMS",
                agency_or_institution="Southwest Research Institute (SwRI)",
                mass_kg=22.0,
                objective="Measure electromagnetic sounding and thermal heat flow inside the South Pole-Aitken basin anomaly.",
                instrument_type="Magnetotelluric Sounder"
            ),
            CLPSPayload(
                payload_id="MAG",
                name="Schrödinger Basin Surface Magnetometer",
                acronym="MAG",
                agency_or_institution="UC Berkeley SSL",
                mass_kg=4.5,
                objective="Map crustal magnetic anomalies and solar wind interactions on the lunar far side.",
                instrument_type="Fluxgate Magnetometer"
            )
        ],
        summary="Draper and NASA mutually agreed to end this CLPS task order in July 2026. Draper's SERIES-2 lander had been slated to deliver the Farside Seismic Suite and other instruments to Schrödinger Basin on the lunar far side—a pioneering site for farside seismology."
    ),

    CLPSMission(
        mission_id="TO-IM3-VERTEX",
        task_order="Task Order IM-3",
        vendor="Intuitive Machines",
        lander_name="Nova-C",
        target_region="Reiner Gamma Swirl",
        coordinates=LunarCoordinate(
            latitude=7.50,
            longitude=301.00,
            elevation_km=-1.80,
            is_confirmed=False,
            designation="Target Candidate Region"
        ),
        launch_date=None,
        landing_date=None,
        status="Upcoming",
        lander_specs={
            "propellant": "Liquid Methane / LOX",
            "payload_capacity_kg": 130.0,
            "height_m": 4.0,
            "diameter_m": 1.57,
            "power_generation_w": 220.0,
            "primary_comms": "S-band and X-band DTE"
        },
        payload_array=[
            CLPSPayload(
                payload_id="VERTEX",
                name="Lunar Vertex Rover and Magnetometer Investigation",
                acronym="Lunar Vertex",
                agency_or_institution="JHU Applied Physics Laboratory (APL)",
                mass_kg=45.0,
                objective="Explore the enigmatic high-albedo swirl Reiner Gamma and its localized mini-magnetosphere.",
                instrument_type="Rover & Magnetometer"
            ),
            CLPSPayload(
                payload_id="CADRE",
                name="Cooperative Autonomous Distributed Robotic Exploration",
                acronym="CADRE",
                agency_or_institution="NASA JPL",
                mass_kg=15.0,
                objective="Trio of mini shoe-box sized rovers collaborating autonomously to map surface topology.",
                instrument_type="Autonomous Multi-Agent Swarm"
            )
        ],
        summary="Exploration of the iconic magnetic anomaly and albedo swirl Reiner Gamma in Oceanus Procellarum, deploying autonomous cooperative rovers to sample magnetic field topology. Launch is currently expected in early 2027."
    ),

    CLPSMission(
        mission_id="TO-2-AB-PEREGRINE",
        task_order="Task Order 2-AB (TO-2)",
        vendor="Astrobotic",
        lander_name="Peregrine Mission 1",
        target_region="Sinus Viscositatis (Gruithuisen Domes)",
        coordinates=LunarCoordinate(
            latitude=36.10,
            longitude=319.60,
            elevation_km=-2.00,
            is_confirmed=False,
            designation="Target Candidate Region"
        ),
        launch_date="2024-01-08T07:18:00Z",
        landing_date=None,
        status="Anomaly",
        lander_specs={
            "propellant": "Bi-propellant Hydrazine / MON-25",
            "payload_capacity_kg": 90.0,
            "height_m": 1.9,
            "diameter_m": 2.5,
            "power_generation_w": 200.0,
            "primary_comms": "X-band DTE"
        },
        payload_array=[
            CLPSPayload(
                payload_id="LETS",
                name="Linear Energy Transfer Spectrometer",
                acronym="LETS",
                agency_or_institution="NASA Johnson Space Center",
                mass_kg=1.4,
                objective="Measure ionizing radiation environment during cislunar transit and on the lunar surface.",
                instrument_type="Radiation Sensor"
            ),
            CLPSPayload(
                payload_id="NSS",
                name="Neutron Spectrometer System",
                acronym="NSS",
                agency_or_institution="NASA Ames Research Center",
                mass_kg=4.5,
                objective="Detect hydrogen-bearing compounds and measure regolith composition.",
                instrument_type="Neutron Spectrometer"
            ),
            CLPSPayload(
                payload_id="PITMS",
                name="Peregrine Ion-Trap Mass Spectrometer",
                acronym="PITMS",
                agency_or_institution="NASA Goddard / Open University",
                mass_kg=9.2,
                objective="Characterize lunar exosphere volatiles.",
                instrument_type="Ion-Trap Mass Spectrometer"
            )
        ],
        summary="Astrobotic's maiden CLPS flight launched aboard Vulcan Centaur on January 8, 2024. A propellant leak after separation made landing impossible; operators successfully guided the spacecraft through 10 days of cislunar science operations before a controlled destructive re-entry over the South Pacific on January 18, 2024."
    )
]

def get_all_missions() -> List[CLPSMission]:
    return CLPS_CATALOG

def get_mission_by_id(mission_id: str) -> Optional[CLPSMission]:
    for m in CLPS_CATALOG:
        if m.mission_id.lower() == mission_id.lower():
            return m
    return None
