FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
COPY public ./public
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/wetalk-server-*.jar app.jar
COPY --from=build /app/public ./public
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=dev
ENV JAVA_OPTS="-Xmx256m -Xss512k -XX:+UseSerialGC"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar --server.port=${PORT:-8080}"]
