import {
  getAllHospitableProperties,
  mapHospitableProperty,
} from "../src/features/integrations/hospitable";

async function main() {
  const properties =
    await getAllHospitableProperties();

  console.log(
    `Loaded ${properties.length} Hospitable ${
      properties.length === 1
        ? "property"
        : "properties"
    }.`,
  );

  const mappedProperties = properties.map(
    mapHospitableProperty,
  );

  console.log(
    JSON.stringify(
      mappedProperties.map((mapping) => ({
        externalId: mapping.externalId,
        externalName: mapping.externalName,
        mappedName: mapping.property.name,
        city: mapping.property.city,
        state: mapping.property.state,
        bedrooms:
          mapping.property.bedrooms,
        bathrooms:
          mapping.property.bathrooms,
        maxGuests:
          mapping.property.max_guests,
        status:
          mapping.property.status,
      })),
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
