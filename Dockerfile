FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/wetalk-server-*.jar app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=dev
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
