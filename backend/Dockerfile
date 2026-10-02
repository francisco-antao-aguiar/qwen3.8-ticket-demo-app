# ---- Build stage: compile the fat jar with Maven ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
# Copy the pom first so dependency downloads are cached across builds
COPY pom.xml .
RUN mvn -q -B dependency:go-offline || true
COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- Run stage: JRE only ----
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /build/target/ticketshop-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
