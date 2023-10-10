const ioredis = require('ioredis');
const { loadConfig } = require('./config.cjs');

async function main(args) {
  const configName = args.length > 0 ? args[0] : 'file:medplum.config.json';

  const config = await loadConfig(configName);

  const redis = new ioredis.Redis(config.redis);

  // Get the number of items in the cache.
  // This is derived from the Redis keyspace statistic, summing all of the keys in the entire keyspace.
  const count = await redis.dbsize();
  console.log('Redis cache size:', count);

  await getCounts(redis);

  redis.disconnect();
  console.log('Done');
}

async function getCounts(redis) {
  const resourceTypes = [
    'Account',
    'ActivityDefinition',
    'AdverseEvent',
    'AllergyIntolerance',
    'Appointment',
    'AppointmentResponse',
    'AuditEvent',
    'Basic',
    'Binary',
    'BiologicallyDerivedProduct',
    'BodyStructure',
    'Bundle',
    'CapabilityStatement',
    'CarePlan',
    'CareTeam',
    'CatalogEntry',
    'ChargeItem',
    'ChargeItemDefinition',
    'Claim',
    'ClaimResponse',
    'ClinicalImpression',
    'CodeSystem',
    'Communication',
    'CommunicationRequest',
    'CompartmentDefinition',
    'Composition',
    'ConceptMap',
    'Condition',
    'Consent',
    'Contract',
    'Coverage',
    'CoverageEligibilityRequest',
    'CoverageEligibilityResponse',
    'DetectedIssue',
    'Device',
    'DeviceDefinition',
    'DeviceMetric',
    'DeviceRequest',
    'DeviceUseStatement',
    'DiagnosticReport',
    'DocumentManifest',
    'DocumentReference',
    'EffectEvidenceSynthesis',
    'Encounter',
    'Endpoint',
    'EnrollmentRequest',
    'EnrollmentResponse',
    'EpisodeOfCare',
    'EventDefinition',
    'Evidence',
    'EvidenceVariable',
    'ExampleScenario',
    'ExplanationOfBenefit',
    'FamilyMemberHistory',
    'Flag',
    'Goal',
    'GraphDefinition',
    'Group',
    'GuidanceResponse',
    'HealthcareService',
    'ImagingStudy',
    'Immunization',
    'ImmunizationEvaluation',
    'ImmunizationRecommendation',
    'ImplementationGuide',
    'InsurancePlan',
    'Invoice',
    'Library',
    'Linkage',
    'List',
    'Location',
    'Measure',
    'MeasureReport',
    'Media',
    'Medication',
    'MedicationAdministration',
    'MedicationDispense',
    'MedicationKnowledge',
    'MedicationRequest',
    'MedicationStatement',
    'MedicinalProduct',
    'MedicinalProductAuthorization',
    'MedicinalProductContraindication',
    'MedicinalProductIndication',
    'MedicinalProductIngredient',
    'MedicinalProductInteraction',
    'MedicinalProductManufactured',
    'MedicinalProductPackaged',
    'MedicinalProductPharmaceutical',
    'MedicinalProductUndesirableEffect',
    'MessageDefinition',
    'MessageHeader',
    'MolecularSequence',
    'NamingSystem',
    'NutritionOrder',
    'Observation',
    'ObservationDefinition',
    'OperationDefinition',
    'OperationOutcome',
    'Organization',
    'OrganizationAffiliation',
    'Parameters',
    'Patient',
    'PaymentNotice',
    'PaymentReconciliation',
    'Person',
    'PlanDefinition',
    'Practitioner',
    'PractitionerRole',
    'Procedure',
    'Provenance',
    'Questionnaire',
    'QuestionnaireResponse',
    'RelatedPerson',
    'RequestGroup',
    'ResearchDefinition',
    'ResearchElementDefinition',
    'ResearchStudy',
    'ResearchSubject',
    'RiskAssessment',
    'RiskEvidenceSynthesis',
    'Schedule',
    'SearchParameter',
    'ServiceRequest',
    'Slot',
    'Specimen',
    'SpecimenDefinition',
    'StructureDefinition',
    'StructureMap',
    'Subscription',
    'Substance',
    'SubstanceNucleicAcid',
    'SubstancePolymer',
    'SubstanceProtein',
    'SubstanceReferenceInformation',
    'SubstanceSourceMaterial',
    'SubstanceSpecification',
    'SupplyDelivery',
    'SupplyRequest',
    'Task',
    'TerminologyCapabilities',
    'TestReport',
    'TestScript',
    'ValueSet',
    'VerificationResult',
    'VisionPrescription',
    'Project',
    'ClientApplication',
    'User',
    'ProjectMembership',
    'Bot',
    'Login',
    'PasswordChangeRequest',
    'JsonWebKey',
    'AccessPolicy',
    'UserConfiguration',
    'BulkDataExport',
    'SmartAppLaunch',
    'DomainConfiguration',
    'AsyncJob',
    'Agent',
  ];

  const counts = {};
  for (const resourceType of resourceTypes) {
    console.log('Counting', resourceType);
    const count = await countKeysByPrefix(redis, resourceType + '/');
    console.log('Count', resourceType, count);
    if (count > 0) {
      counts[resourceType] = count;
    }
  }
  console.log(JSON.stringify(counts, null, 2));
}

async function countKeysByPrefix(redis, prefix) {
  let cursor = '0';
  let count = 0;
  do {
    const result = await redis.scan(cursor, 'MATCH', prefix + '*', 'COUNT', 1000);
    cursor = result[0];
    count += result[1].length;
  } while (cursor !== '0');
  return count;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exit(1);
});
