FROM maven:3.9-eclipse-temurin-21
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn package -DskipTests -q
CMD java -jar /app/target/wetalk-server-4.0.0-SNAPSHOT.jar --server.port=${PORT:-8080}
