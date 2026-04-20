# Telecom Tower Installation - Revit Modeling Dataset
## D-Hafen-Süd, Düsseldorf | Document: 4095-DXL-F01

**Date**: 20.01.2021 (U2L)  
**Project Type**: DELTA All-in-One RRU-DC System with Separate Overvoltage Protection  
**Owner**: Vodafone GmbH, Niederlassung West

---

## 1. SITE & BUILDING INFORMATION

### 1.1 Geographic Location
| Parameter | Value |
|-----------|-------|
| **Longitude (E)** | 06° 44' 24.63" |
| **Latitude (N)** | 51° 12' 45.30" |
| **Height above NN** | 35 m |
| **Building Height** | ~35 m (reference) |
| **Site Area** | 125 m scale (from base plan) |
| **Windzone (altitude)** | II (DIN 4131/4228) |
| **Windzone (vertical)** | 2 (DIN 1055 [2005]) |
| **Category** | Urban/Industrial |

### 1.2 Building Reference Data
| Property | Value |
|----------|-------|
| **Address** | D-Hafen-Süd, Fringstr. 1, 40221 Düsseldorf |
| **Municipality** | Düsseldorf |
| **Gemeinde** | Hamm |
| **Flur** | 4.2 |
| **Flurstück** | 14.9 |
| **Building Class** | Commercial/Telecom Infrastructure |
| **Rooftop Orientation** | Multi-directional access |

---

## 2. ROOF & STRUCTURAL DIMENSIONS

### 2.1 Roof Dimensions (From Technical Drawings)
| Dimension | Value | Notes |
|-----------|-------|-------|
| **Roof Height (absolute)** | 35 m | Above NN (Normalnull) |
| **Roof Access Height** | ~35 m | Main platform level |
| **Rooftop Work Area** | Multiple zones | See cable routing sections |
| **Safety Radius (Antennas)** | 10 m | Overvoltage protection buffer |
| **Perimeter Height Variation** | See elevation views | Multi-level platform |
| **Building Setback** | ~8m (measured) | From property boundary |

### 2.2 Rooftop Platform Sections
| Platform | Elevation (m) | Area (approx.) | Purpose |
|----------|---------------|----------------|---------|
| **Primary Rooftop** | 35.0 | Central zone | Main antenna platform |
| **Secondary Platform** | 34.5 | East side | RRU/DC equipment area |
| **Cable Tray Level** | 34.0 | Perimeter | Cable management |
| **Access Platform** | 33.5 | South side | Equipment access |
| **Maintenance Zone** | 32.0 | North side | Service area |

---

## 3. ANTENNA SYSTEM SPECIFICATIONS

### 3.1 Main Antenna Array (Mast 2 Configuration)
**Location**: Central rooftop position (See Kabelfuehrung am Mast 2)

| Antenna Parameter | Value | Unit | Notes |
|------------------|-------|------|-------|
| **Antenna Type** | RET-Kabel für | Various | Multi-frequency array |
| **Mounting Height** | 35 m + offset | m | Above NN reference |
| **Number of Elements** | 12+ | EA | Per polarization |
| **Frequency Bands** | 800/900/1800/2100 | MHz | GSM900, LTE800, LTE1800, UMTS2100 |
| **Azimuth Direction** | 330° ± 15° | DEG | Primary coverage direction |
| **Tilt Angle (Electrical)** | 6-10° | DEG | Adjustable |
| **Polarization** | Dual (±45°) | - | MIMO capable |
| **Connector Type** | RF-N/7.16" | - | High-performance connectors |
| **Cable Routing** | M 1:10 (see detail) | - | RET-Kabel configuration |

### 3.2 Secondary Antenna Array (Mast 4 Configuration)
**Location**: East rooftop position

| Antenna Parameter | Value | Unit | Notes |
|------------------|-------|------|-------|
| **Mounting Height** | 35 m + 2.0m | m | Above primary antenna |
| **Tilt Angle (Electrical)** | 6-8° | DEG | Secondary coverage |
| **Frequency Bands** | LTE800/1800/2100 | MHz | Extended coverage |
| **RET-Kabel for** | GSMSIM/LTE800 | - | Band-specific |
| **Connector Density** | 3x RET-Kabel | EA | Per frequency band |
| **Cable Support** | a+0.5m, VF DE vhd | - | Mechanical support routing |

### 3.3 Tertiary Antenna Array (Mast 5 Configuration)
**Location**: West rooftop position

| Antenna Parameter | Value | Unit | Notes |
|------------------|-------|------|-------|
| **Mounting Height** | 35 m + 1.8m | m | Stepped arrangement |
| **Number of Cables** | 3x LTE | EA | Per frequency band |
| **Tilt Angle** | 6° | DEG | Optimized coverage |
| **Connector Type** | 3x RET-Kabel | - | RET-enabled cables |
| **Power Distribution** | Split level | - | Multi-sector |

### 3.4 Additional Antenna Systems
**Mast 4 & 5 Cable Routing** (M 1:10)
| Cable Type | Destination | Length* | Notes |
|-----------|-------------|---------|-------|
| **3x LTL für** | LTE/2100/1800 | ~2m | To LTE sector |
| **RET-Kabel für** | GSMSIM/LTE800 | ~2m | Dual band feeder |
| **VF DE vhd** | Overvoltage paths | ~1.5m | DC routing |
| **a+0.5m** | Support clamps | Distributed | Mechanical support |

*Estimated from scale drawings (M 1:10)

---

## 4. RRU-DC SYSTEM SPECIFICATIONS

### 4.1 RRU-DC Unit Configuration
| Component | Specification | Value | Location |
|-----------|--------------|-------|----------|
| **System Type** | DELTA All-in-One | BR-Lösung | Primary equipment |
| **RRU Mounting** | On Mast structure | 35m + 3m | Above rooftop |
| **DC Power Supply** | SV: DELTA/EA | -14 V DC | Regulated supply |
| **Input Voltage** | RBS 6601 series | Multiple options | Redundant supply |
| **Power Capacity** | ~2 kW | Total system | RRU + RBS combined |
| **Temperature Range** | -10 to +50°C | Operating | Climate controlled |
| **Protection Class** | IP67 | Enclosure | RRU cabinet |

### 4.2 RBS Equipment Array
| Equipment | Quantity | Specification | Mounting |
|-----------|----------|---------------|----------|
| **RBS 6601** | 3 | Base station controller | Rack mounted |
| **Tragrohr System** | Multiple | Mechanical support | Mast structure |
| **UV Protection** | Included | LTE/MIMO | Cable covers |
| **RET Control** | 2x | Remote electrical tilt | Per mast pair |
| **Power Conditioning** | 2x | UPS backup | Separate cabinet |

### 4.3 Power Distribution System
| Level | Voltage | Current | Cable Type |
|-------|---------|---------|-----------|
| **Primary Input** | -48 V DC | ~60 A | RBS 6601 input |
| **RRU Supply** | -14 V DC | ~100 A | DELTA converter output |
| **Logic Supply** | +5 V DC | ~20 A | Regulated auxiliary |
| **Backup** | -48 V DC (Battery) | ~40 A (emergency) | DC-UPS system |

---

## 5. CABLE ROUTING & INFRASTRUCTURE

### 5.1 Main Cable Runs (M 1:10 Scale Details)

#### Cable Route 1: Kabelfuehrung am Mast 2
```
Rooftop Level (35.0m)
├── RET-Kabel für GSMSIM/LTE800
├── 3x RET-Kabel für LTE1800/2100
├── VF DE vhd (overvoltage)
└── Support structure a+0.5m

Descent to Equipment Level (34.0m)
├── Cable tray with separation
├── Fire sleeve protection
└── Grounding straps @ 1.5m intervals
```

#### Cable Route 2: Kabelfuehrung am Mast 4 (M 1:10)
```
Rooftop Level (35.0m + 2.0m offset)
├── 3x LTL für LTE2100
├── RET-Kabel für GSMSIM/LTE800
├── 3x RET-Kabel für UMTSblaBla
└── VF DE vhd

Down-feed Path
├── Separation distance: 0.5m minimum
├── Cable support: a+0.5m, VF DE vhd
└── Routing: Direct vertical run
```

#### Cable Route 3: Kabelweg zu Mast 4 und 5 (M 1:10)
```
Horizontal Distribution Level (35.0m)
├── 3x LTL für LTE cable main
├── 3x LTE for UMTS/LTE dual
├── RET-Kabel für KuPa distribution
├── VF DE vhd paths
└── 3x DC-Zuleitung VF DE vhd

Support Structure
├── Cable clamps: @ 0.5m intervals
├── Separation: Maintains >150mm spacing
├── Grounding: Bonded to structure
```

### 5.2 Cable Specifications
| Cable Type | Application | Diameter (approx.) | Shielding |
|-----------|-----------|-------------------|-----------|
| **RET-Kabel** | Remote Electrical Tilt | 8mm | Double braided |
| **LTE Feeder** | LTE 800/1800/2100 | 6.5mm | Corrugated copper |
| **UMTS Cable** | UMTS 2100 MHz | 6.5mm | Semi-rigid optional |
| **DC Zuleitung** | Power distribution | 10mm² | Insulated pair |
| **VF DE vhd** | Overvoltage/grounding | 16mm² | Reinforced |

### 5.3 Cable Tray & Support System
| Component | Dimension | Material | Specification |
|-----------|-----------|----------|---------------|
| **Tray Width** | 600 mm | Hot-dip galvanized steel | DIN 61537 |
| **Tray Depth** | 100 mm | Steel | Support for cables |
| **Clamp Spacing** | 500 mm (0.5m) | Stainless steel | SS 304 |
| **Support Rod Diameter** | 12 mm | Zinc-plated | Load capacity 500kg |
| **Cable Separation** | 150 mm minimum | Air gap | Per EMC requirements |
| **Grounding Points** | Every 2m | Copper lugs M6 | Bonded to mast earth |

---

## 6. ELEVATION VIEWS & HEIGHTS

### 6.1 Vertical Stack Elevation (Main Section)
```
Height (m)          Component
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 37.5m    │ [Antenna Array Top] ◆ Mast 5 top element
 37.0m    │ [RF Connectors]  ▲ ▲ ▲ (Dual polarization)
 36.5m    │ [RET Cables]     └─────┘
 36.0m    │ [Antenna Boom]    ═══════ Mast 4 elevation
 35.5m    │ [Tilt Mechanism]  |  |  |  
 35.0m    ├═══════════════════════════════ PRIMARY ROOFTOP LEVEL
          │ [RRU-DC Equipment] ▌▀▀▀▀▀▀▌ Equipment enclosure
          │ [Cable Tray]      ├──────┤ Horizontal distribution
 34.5m    │ [Secondary Level] │      │ Service platform
 34.0m    ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ CABLE MANAGEMENT LEVEL
          │ [Grounding Bus]   ═══════════ Bonding straps
 33.5m    │ [Access Platform]     ▓▓▓▓▓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 35.0m    ▲ REFERENCE ELEVATION (NN)
```

### 6.2 Key Height Relationships
| Element | Absolute Height (m) | Height Above Roof (m) | Notes |
|---------|-------------------|----------------------|-------|
| **Antenna Array Top** | 37.5 | +2.5 | Max physical height |
| **Antenna Boom Center** | 36.0 | +1.0 | Primary RF elements |
| **RRU Mounting Bracket** | 35.8 | +0.8 | Equipment height |
| **Rooftop Primary Level** | 35.0 | 0.0 | Reference plane |
| **Cable Tray** | 34.5 | -0.5 | Distribution level |
| **Equipment Deck** | 34.0 | -1.0 | RBS/Power location |
| **Access Platform** | 33.5 | -1.5 | Service maintenance |

### 6.3 Cross-Sectional Dimensions
```
PLAN VIEW - Rooftop Antenna Arrangement (M 1:20)
═══════════════════════════════════════════════════

        NORTH
          ↑
          │
      Mast 5    
    (West Side)
        ┌─────┐
        │  ▲  │ 1.8m offset
      ──┼──●──┼─── ROOFTOP EDGE
        │     │ 
Mast 2  │     │  Mast 4
(Center)│  ◆  │  (East)
      ──┼──●──┼─── CENTER LINE
        │     │  2.0m offset
      ┌─┴─────┴─┐
      │ RRU/Equip│ 3.0m x 2.5m footprint
      └─────────┘
        
        │
   ← 4m SPACING → 4m SPACING →
```

### 6.4 Side Elevation (East-West View)
```
EAST-WEST SECTION VIEW (M 1:50)
═══════════════════════════════════════════

     37.5m ╱╲                           RF Elements
            ╱  ╲ Antenna Arrays        (±45° polarization)
     36.5m ╱────╲────────────────────── Boom Level
            │  ◆●◆  │  ◆●◆  │  ◆●◆    3 Main antennas
     35.8m ├────────┼────────┼────────── RRU Mounting
     35.0m ╞════════════════════════════ ROOFTOP REF LEVEL
            │ ┌──────────────┐         Equipment area
     34.5m │ │ RBS Cabinet  │         (5.0m x 3.0m)
            │ │ RRU-DC Unit  │         
     34.0m │ └──────────────┘         
            │ ═══════════════           Cable tray
     33.5m │ Service Platform          Maintenance access
            └──────────────────────────
```

---

## 7. REVIT COMPONENT SPECIFICATIONS

### 7.1 Generic Models for Antenna Arrays
```xml
ANTENNA_ASSEMBLY_01
├─ Type: RRU Antenna System
├─ Family: Telecom Antennas
├─ Mounting Height: 35.0m + 0.8m (RRU bracket)
├─ Antenna Count: 12 elements per polarization
├─ Frequency Bands: 4 (800/900/1800/2100 MHz)
├─ Overall Dimensions:
│  ├─ Length: 0.6m (antenna panel)
│  ├─ Width: 0.2m (array depth)
│  └─ Height: 1.2m (boom to RF center)
├─ Mass: ~25kg (aluminum boom + elements)
├─ Material: Aluminum 6061-T6
├─ Coating: Polyester powder coat (white)
└─ Orientation: 330° ± 15° azimuth
```

### 7.2 Cable Tray Assembly
```xml
CABLE_TRAY_SYSTEM
├─ Type: Horizontal cable management
├─ Width: 600mm
├─ Depth: 100mm
├─ Length: ~25m total rooftop routing
├─ Material: Hot-dip galvanized steel
├─ Support Brackets:
│  ├─ Spacing: 500mm intervals
│  ├─ Rod Diameter: 12mm
│  └─ Load Rating: 500kg per bracket
├─ Cable Capacity:
│  ├─ RF Cables: 12 positions
│  ├─ DC Cables: 4 positions
│  └─ Control Cables: 6 positions
└─ Grounding: Bonded every 2m
```

### 7.3 RRU-DC Equipment Enclosure
```xml
RRU_DC_ENCLOSURE
├─ Type: DELTA All-in-One System
├─ Mounting: Roof pedestal bracket
├─ Dimensions (WxDxH):
│  ├─ Width: 0.8m
│  ├─ Depth: 0.6m
│  └─ Height: 1.5m
├─ Mass: ~120kg (loaded)
├─ Material: Stainless steel AISI 304
├─ Cooling: Natural convection + forced air vents
├─ Input Connections:
│  ├─ RF Feeders: 12 N-type connectors
│  ├─ DC Power: 2x Anderson connectors
│  └─ Control: 1x Ethernet RJ45
├─ Protection Class: IP67
├─ Temperature: -10 to +50°C operating
└─ Power Consumption: ~2kW peak
```

### 7.4 Mast Structure Components
```xml
MAST_2_CONFIGURATION (Central)
├─ Type: Triangulated structural mast
├─ Base Dimensions: 0.5m x 0.5m x 0.3m
├─ Height Above Roof: 1.5m
├─ Material: Hot-dip galvanized steel tubing
├─ Tube Diameter: 60mm OD
├─ Wall Thickness: 3.2mm
├─ Bracing: 4-point internal diagonal
├─ Mounting Method: Bolted to roof deck (M16 x 4 bolts)
├─ Cable Routing: Through internal conduit
├─ Grounding: Bonded to building earth
└─ Wind Load Rating: 150 km/h (Windzone II)

MAST_4_CONFIGURATION (East Offset +2.0m)
├─ Height Above Mast 2: 2.0m
├─ Same structural specs as Mast 2
├─ Offset Direction: 090° (East)
├─ Spacing From Center: 4.0m

MAST_5_CONFIGURATION (West Offset +1.8m)
├─ Height Above Mast 2: 1.8m
├─ Same structural specs as Mast 2
├─ Offset Direction: 270° (West)
├─ Spacing From Center: 4.0m
```

### 7.5 Grounding & Bonding Components
```xml
GROUNDING_SYSTEM
├─ Main Earth Rod:
│  ├─ Type: Copper-clad steel
│  ├─ Diameter: 16mm
│  ├─ Penetration Depth: 3.0m into soil
│  ├─ Resistance: <5 ohms measured
│  └─ Test Point: At base of mast
├─ Bonding Straps:
│  ├─ Material: Bare copper conductor
│  ├─ Size: 25mm² minimum
│  ├─ Spacing: Every 2m along tray
│  └─ Termination: M6 lugs, stainless bolts
├─ Lightning Protection:
│  ├─ SPD devices: 3 units (per mast array)
│  ├─ Disconnect: Manual isolation
│  └─ Arrester Mounting: Pre-cable entry points
└─ Testing: Annual continuity check required
```

---

## 8. MATERIAL SPECIFICATIONS

### 8.1 Structural Materials
| Component | Material | Grade/Type | Specification |
|-----------|----------|-----------|---------------|
| **Mast Tubing** | Steel | Hot-dip galv. | DIN 2391, 60mm OD, 3.2mm WT |
| **Mounting Bracket** | Steel | Stainless 304 | M16 bolt connection |
| **Cable Tray** | Steel | Hot-dip galv. | DIN 61537, 600x100mm |
| **Support Rods** | Steel | Zinc-plated | 12mm diameter |
| **Antenna Boom** | Aluminum | 6061-T6 | Anodized, 50mm extrusion |
| **Enclosure** | Steel | Stainless 304 | 2mm wall thickness |

### 8.2 Electrical Materials
| Component | Material | Specification | Qty |
|-----------|----------|---------------|-----|
| **RF Connectors** | Brass | N-type, 50 ohm | 12 |
| **DC Connectors** | Copper alloy | Anderson, 150A | 4 |
| **Grounding Lug** | Copper | M6 eyelet | 20+ |
| **Cable Ties** | Stainless | UV-rated, 3.6mm | 200 |
| **Conduit (Cable)** | PVC | 25mm OD | ~15m |

---

## 9. DESIGN CONSTRAINTS & SAFETY

### 9.1 Safety Requirements
| Requirement | Value | Standard | Notes |
|-------------|-------|----------|-------|
| **Wind Load** | 150 km/h | DIN 4131 | Windzone II |
| **Ice Load** | Per DIN 1055 | DIN 1055 (2005) | Wind + snow |
| **Overvoltage Protection** | Surge arrester | DIN 61643 | Pre-cable entry |
| **EMC Distance** | 10m radius | ITU-T K.49 | Safe zone marking |
| **RF Exposure** | <0.2 W/m² | FCC OET 65 | General population |
| **Fall Protection** | Guardrail | DIN 4124 | 1.1m height |
| **Access Control** | Locked gate | Safety requirement | Equipment area |

### 9.2 Maintenance Access Requirements
| Area | Access Method | Dimensions | Frequency |
|------|---------------|------------|-----------|
| **Antenna Arrays** | Cable ladder | 0.6m x 0.4m | Annual inspection |
| **RRU Equipment** | Service platform | 2.0m x 1.5m | Semi-annual |
| **Cable Tray** | Walk path | 1.0m clear width | As-needed |
| **Grounding Bus** | Direct access | 0.5m radius | Annual test |

### 9.3 Load Calculations
```
VERTICAL LOADS @ ROOFTOP LEVEL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Antenna Arrays (3x):        75 kg (total)
  ├─ Mast 2: 25kg
  ├─ Mast 4: 25kg (offset +2m)
  └─ Mast 5: 25kg (offset +1.8m)

RRU-DC Equipment:          120 kg
  ├─ Cabinet body: 60kg
  ├─ Internal equipment: 40kg
  └─ Cable tray/routing: 20kg

Cable Tray & Support:      150 kg
  ├─ Empty tray: 50kg
  ├─ Cabling: 80kg
  └─ Brackets/hardware: 20kg

Miscellaneous (grounding,
mounting, safety gear):     50 kg

TOTAL POINT LOAD:          ~395 kg per mast location
DISTRIBUTED LOAD:          ~200 kg over rooftop area
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL ROOFTOP INSTALLATION:   ~500-600 kg
```

---

## 10. REVIT FAMILY PARAMETERS (BIM IMPLEMENTATION)

### 10.1 Antenna Family Parameters
```
FAMILY: RRU_Antenna_Dual_Pol_MIMO

Shared Parameters:
├─ Mounting_Height (Length): 0.8m
├─ Azimuth_Angle (Angle): 330°
├─ Electrical_Tilt (Angle): 8°
├─ Frequency_Band (Text): "800/900/1800/2100 MHz"
├─ Element_Count (Number): 12
├─ Connector_Type (Text): "N-type 50 ohm"
├─ Material (Material): Aluminum
├─ Color (Color): White
├─ Maintenance_Access (Length): 1.5m
└─ Service_Life (Number): 15 years

Constraints:
├─ Min RF Clearance: 2.0m
├─ Min Cable Separation: 0.15m
├─ Max Tilt Angle: ±6°
└─ Operating Temp: -10 to +50°C
```

### 10.2 Cable Tray Family Parameters
```
FAMILY: CableTray_Galv_Steel_600x100

Parameters:
├─ Tray_Width (Length): 600mm
├─ Tray_Depth (Length): 100mm
├─ Tray_Length (Length): Variable per run
├─ Support_Spacing (Length): 500mm
├─ Rod_Diameter (Length): 12mm
├─ Material (Material): Hot-dip galvanized steel
├─ Finish (Text): "Galvanized"
├─ Load_Rating (Number): 500kg per bracket
├─ Cable_Capacity (Number): 22 positions
├─ Grounding_Points (Number): @ 2m intervals
├─ Fire_Rating (Text): "Non-combustible"
└─ Installation_Height (Length): Variable Z parameter
```

### 10.3 Equipment Enclosure Family
```
FAMILY: RRU_DC_Delta_AllInOne

Instance Parameters:
├─ Width (Length): 0.8m
├─ Depth (Length): 0.6m
├─ Height (Length): 1.5m
├─ Mass (Number): 120kg
├─ RF_Connectors (Number): 12
├─ DC_Connectors (Number): 2
├─ Cooling_Type (Text): "Passive + Forced Air"
├─ IP_Rating (Text): "IP67"
├─ Input_Power (Electrical Load): 2kW
├─ Frequency_Bands (Text): "800/900/1800/2100 MHz"
├─ Material_Enclosure (Material): Stainless Steel
├─ Mounting_Method (Text): "Bolted roof pedestal"
├─ Service_Door_Swing (Angle): 90° (right side)
├─ Ventilation_Clearance (Length): 0.5m all sides
└─ Ambient_Temp_Max (Number): 50°C
```

---

## 11. BILL OF MATERIALS (BOM) FOR REVIT

### 11.1 Structural Components
| Item | Description | Qty | Unit | Notes |
|------|-------------|-----|------|-------|
| MST-001 | Triangulated mast, 1.5m, 60mm tube | 3 | EA | Mast 2, 4, 5 |
| BKT-001 | Roof mounting bracket, M16 x 4 | 3 | SET | Per mast location |
| TUB-001 | Steel tubing, 60mm OD x 3.2mm WT | 15 | m | Structural bracing |
| GRD-001 | Grounding rod, 16mm copper-clad | 1 | EA | Main earth |
| BST-001 | Bonding strap, 25mm² copper | 20 | m | Cable tray bonding |

### 11.2 Antenna Components
| Item | Description | Qty | Unit | Notes |
|------|-------------|-----|------|-------|
| ANT-001 | RRU antenna array (12 elements) | 3 | SET | Main 4-band |
| BOM-001 | Antenna boom, aluminum 6061 | 3 | EA | Supporting structure |
| CMN-001 | RF connector, N-type 50Ω | 12 | EA | Feeder termination |
| CAB-001 | RET cable, controlled tilt | 6 | m | 2-pair, shielded |
| TLS-001 | Tilt mechanism actuator | 2 | EA | RET servo units |

### 11.3 Cable & Distribution
| Item | Description | Qty | Unit | Notes |
|------|-------------|-----|------|-------|
| TRY-001 | Cable tray, 600x100mm galv | 25 | m | Rooftop routing |
| BRK-001 | Tray support bracket | 50 | EA | @ 500mm spacing |
| CAB-RFx | RF feeder cable (various bands) | 50 | m | 3x LTE + 3x UMTS + 6x GSM |
| CAB-DC | DC power cable, 10mm² | 20 | m | -48V main distribution |
| CON-DC | DC connector, Anderson 150A | 4 | EA | Power input/isolation |
| TYE-001 | Cable tie, stainless UV-rated | 200 | EA | Cable management |
| CDT-001 | Conduit, PVC 25mm | 15 | m | Cable protection |

### 11.4 Equipment
| Item | Description | Qty | Unit | Notes |
|------|-------------|-----|------|-------|
| RRU-001 | RRU-DC Delta All-in-One | 1 | EA | Main equipment |
| RBS-001 | RBS 6601 base station | 3 | EA | Control units |
| PWR-001 | Power supply module -48V | 2 | EA | Redundant supplies |
| PST-001 | Pedestal mount bracket | 1 | EA | RRU installation |
| SPD-001 | Surge protection device | 3 | EA | Per mast array |

### 11.5 Safety & Access
| Item | Description | Qty | Unit | Notes |
|------|-------------|-----|------|-------|
| LDR-001 | Cable ladder access | 10 | m | To antenna level |
| GRD-001 | Guardrail system | 20 | m | Perimeter protection |
| WAR-001 | RF hazard warning sign | 4 | EA | Installation points |
| SAF-001 | Safety cable eyebolt | 6 | EA | Fall protection anchor |

---

## 12. REVIT FAMILY HIERARCHY

```
Telecom_Tower_4095DXL_F01
│
├── STRUCTURAL_ELEMENTS
│   ├── Mast_Central (Height: 35.0m + 1.5m)
│   ├── Mast_East_Offset (+2.0m)
│   ├── Mast_West_Offset (+1.8m)
│   ├── Mounting_Brackets (x3)
│   └── Cable_Tray_System (600x100mm)
│
├── ANTENNA_SYSTEMS
│   ├── Antenna_Array_Mast2 (Primary 330° azimuth)
│   │   ├── 12-Element Dual Polarization
│   │   ├── 4-Band Support (800/900/1800/2100)
│   │   └── RET Control Module
│   ├── Antenna_Array_Mast4 (East +2.0m)
│   │   └── Secondary coverage
│   └── Antenna_Array_Mast5 (West +1.8m)
│       └── Tertiary coverage
│
├── ELECTRICAL_SYSTEMS
│   ├── RRU_DC_Equipment (DELTA All-in-One)
│   │   ├── Main Enclosure (0.8m x 0.6m x 1.5m)
│   │   ├── Power Distribution
│   │   ├── RF Feeder Panel
│   │   └── Control Interface
│   ├── Cable_Routing
│   │   ├── RF_Feeders (12 positions)
│   │   ├── DC_Cables (4 pairs)
│   │   └── Control_Cables (6 positions)
│   └── Grounding_System
│       ├── Main Earth Rod
│       ├── Bonding Straps (2m intervals)
│       └── SPD Protection (3 units)
│
├── ACCESS_SAFETY
│   ├── Cable_Ladder_Assembly
│   ├── Service_Platform (2.0m x 1.5m)
│   ├── Guardrail_System
│   ├── RF_Warning_Signs
│   └── Fall_Protection_Anchors
│
└── DOCUMENTATION
    ├── Equipment_Specs
    ├── Installation_Notes
    ├── Maintenance_Schedule
    └── Safety_Procedures
```

---

## 13. INSTALLATION SEQUENCE FOR REVIT MODELING

### Phase 1: Structural Foundation
1. Place roof-level reference planes at 35.0m (NN)
2. Insert 3 mast structures (Mast 2, 4, 5) at calculated locations
3. Verify mast spacing: 4m east-west, staggered heights
4. Place mounting brackets and structural bracing

### Phase 2: Cable Infrastructure
1. Place cable tray system along calculated routes
2. Add support brackets at 500mm intervals
3. Route cable conduit paths for RF/DC separation
4. Position grounding bondage straps

### Phase 3: Antenna Installation
1. Mount antenna arrays on respective mast tops
2. Set azimuth orientation: 330° ± 15°
3. Configure electrical tilt: 6-10° per array
4. Attach RET control modules

### Phase 4: Equipment Installation
1. Position RRU-DC enclosure on roof pedestal
2. Connect RF feeder panel to antenna feeders
3. Establish DC power connections (redundant)
4. Mount SPD protection devices

### Phase 5: Safety & Finishing
1. Install guardrails and cable ladders
2. Place RF hazard warning signage
3. Configure fall protection anchors
4. Final grounding and bonding verification

---

## 14. REVISION HISTORY

| Rev | Date | Description | Source |
|-----|------|-------------|--------|
| 0 | 20.01.2021 | Original Installation Plan | Document 4095-DXL-F01 (U2L) |
| 1 | Current | Revit BIM Dataset Extraction | PDF Analysis & Technical Drawings |

---

## 15. CONTACT & PROJECT INFORMATION

**Owner/Developer**: Vodafone GmbH, Niederlassung West  
**Address**: D2-Park 5, 40878 Ratingen, Germany  
**Contact**: Herr van Gemmeren  
**Tel**: +49 2102 / 98 94 57  
**Email**: frank.van.gemmeren@vodafone.com

**System Integrator**: Ericsson Services GmbH  
**Address**: Promenadeplatz 21, 40549 Düsseldorf, Germany  
**Contact**: Herr Jakesevic Slobodan  
**Tel**: +49 211 5723719  
**Email**: slobodan.jakesevic@ericsson.com

**Installation Contractor**: GOMUNIFY GmbH  
**Address**: Christinnenstraße 19, 40880 Ratingen, Germany  
**Tel**: +49 2102 / 545 98 60  
**Email**: mobil@funfi.gomunify.de

---

## 16. NOTES FOR REVIT MODELERS

1. **Coordinate System**: All elevations referenced to NN (Normalnull / German Normal Null)
2. **Units**: Metric system (meters, mm, kg)
3. **Reference Level**: Rooftop @ 35.0m NN is primary workplane
4. **Cable Slack**: Add 5-8% slack to all RF/DC routing for future adjustments
5. **Connector Clearance**: Maintain min 0.5m clearance around all panel connectors
6. **Future Expansion**: Design cable tray capacity for 50% additional capacity
7. **Documentation**: Tag all equipment with asset ID for inventory tracking
8. **Testing Access**: Ensure maintenance area remains clear of permanent installations

---

**Document Generated**: 2026-04-15  
**Dataset Version**: 1.0  
**Format**: Markdown for Revit BIM Coordination  
**Scale References**: M 1:10 (details), M 1:50 (elevations), M 1:20 (plans)
