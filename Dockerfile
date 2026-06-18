FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B -q
COPY src ./src
RUN mvn package -DskipTests -q

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/wetalk-server-*.jar app.jar
ENV SPRING_PROFILES_ACTIVE=dev
EXPOSE 8080
CMD java -jar app.jar --server.port=${PORT:-8080}
