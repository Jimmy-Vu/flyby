import { militaryServiceAbbreviation, type Flight, type FlightDetails } from "./flight";
import { fetchAdsbDbDetails } from "./routes";

export async function getFlightDetails(flight: Flight): Promise<FlightDetails> {
  const info = await fetchAdsbDbDetails(flight.icao24, flight.callsign).catch(() => null);
  if (!info) return {};

  const details: FlightDetails = {
    registration: info.registration || undefined,
    registeredOwner: info.registeredOwner || undefined,
    aircraftType: info.aircraftType || undefined,
  };

  if (flight.kind === "commercial") {
    details.airline = info.airlineName || undefined;
    details.flightNumber = info.flightNumber || undefined;
    details.origin = info.origin || undefined;
    details.destination = info.destination || undefined;
    return details;
  }

  const military = militaryServiceAbbreviation(flight.callsign, info.registeredOwner);
  if (military) {
    details.kind = "military";
    details.badgeLabel = military;
    details.airline = "Military aircraft";
  }
  return details;
}
