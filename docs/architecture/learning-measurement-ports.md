# Learning Measurement Ports

`LearningMeasurementSourcePort` is the boundary between Learning and Investment, Revenue, or Capital. Each adapter checks availability and retrieves a canonical measurement. It does not calculate variance, classify performance, create lessons, or expose provider objects.

Adapters must enforce workspace and subject scope and return metric definition versions, source versions, qualification, evidence, confidence, freshness, and structured unavailability. The registry resolves adapters by versioned measurement-source configuration.
