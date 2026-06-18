FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN apk add --no-cache maven && mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/wetalk-server-*.jar app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=dev
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
