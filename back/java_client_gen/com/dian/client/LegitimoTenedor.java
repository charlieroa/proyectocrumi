
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for LegitimoTenedor complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="LegitimoTenedor">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="FechaInscripcionComoTituloValor" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Nombre" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "LegitimoTenedor", namespace = "http://schemas.datacontract.org/2004/07/LegitimoTenedor", propOrder = {
    "fechaInscripcionComoTituloValor",
    "nombre"
})
public class LegitimoTenedor {

    @XmlElementRef(name = "FechaInscripcionComoTituloValor", namespace = "http://schemas.datacontract.org/2004/07/LegitimoTenedor", type = JAXBElement.class, required = false)
    protected JAXBElement<String> fechaInscripcionComoTituloValor;
    @XmlElementRef(name = "Nombre", namespace = "http://schemas.datacontract.org/2004/07/LegitimoTenedor", type = JAXBElement.class, required = false)
    protected JAXBElement<String> nombre;

    /**
     * Gets the value of the fechaInscripcionComoTituloValor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getFechaInscripcionComoTituloValor() {
        return fechaInscripcionComoTituloValor;
    }

    /**
     * Sets the value of the fechaInscripcionComoTituloValor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setFechaInscripcionComoTituloValor(JAXBElement<String> value) {
        this.fechaInscripcionComoTituloValor = value;
    }

    /**
     * Gets the value of the nombre property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getNombre() {
        return nombre;
    }

    /**
     * Sets the value of the nombre property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setNombre(JAXBElement<String> value) {
        this.nombre = value;
    }

}
